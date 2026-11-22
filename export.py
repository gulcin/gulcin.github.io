#!/usr/bin/env python3
"""Build data.json for the reading site.
With NOTION_TOKEN (internal integration shared with the Reading List DB)
and optional NOTION_DATA_SOURCE_ID, queries the Notion API. Otherwise reads
notion_raw.json when that file exists. If neither is available, keeps the
committed data.json so a rebuild can deploy without a token.
Goodreads uses GOODREADS_USER_ID, defaulting to 22282914.
Written review text is kept (RSS user_review when the shelf feed answers,
otherwise the public shelf widget). A star rating is stored only alongside
that text. Private fields (My notes, For, Why it matters, Added by) are never written."""
import json, os, re, sys, html, urllib.request, email.utils
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from urllib.parse import urlencode, urlparse
TYPE_MAP = {"Blog":"articles","Article":"articles","Post":"articles","Newsletter":"articles",
            "Paper":"papers","Podcast":"podcasts","Talk/Video":"podcasts","Video":"podcasts","Talk":"podcasts"}
READ = {"Read"}
BACKLOG = {"To read","Picked","Reading"}  # "Skip" (or other) -> excluded from read/backlog stats

def from_api():
    tok=os.environ["NOTION_TOKEN"]; ds=os.environ.get("NOTION_DATA_SOURCE_ID","4a5315cf-dec8-4fe5-b3b8-c51f5a9790df")
    rows=[]; cur=None
    while True:
        body={"page_size":100}; cur and body.update(start_cursor=cur)
        req=urllib.request.Request(f"https://api.notion.com/v1/data_sources/{ds}/query",json.dumps(body).encode(),
            {"Authorization":f"Bearer {tok}","Notion-Version":"2025-09-03","Content-Type":"application/json"})
        r=json.load(urllib.request.urlopen(req))
        for p in r["results"]:
            P=p["properties"]; g=lambda k,t:(P.get(k) or {}).get(t)
            rows.append({"Title":"".join(x["plain_text"] for x in g("Title","title") or []),
                "link":g("URL","url"),"Status":(g("Status","select") or {}).get("name"),
                "Type":(g("Type","select") or {}).get("name"),
                "Topics":json.dumps([t["name"] for t in g("Topics","multi_select") or []]),
                "Added":p["created_time"],"digest":(g("Digest date","date") or {}).get("start"),
                "read":(g("Date read","date") or {}).get("start")})
        if not r.get("has_more"): return rows
        cur=r["next_cursor"]

def gr_date(s):
    if not s or not s.strip(): return None
    try: return email.utils.parsedate_to_datetime(s.strip()).strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception: return None

def clean_review(raw):
    """Keep her words. Drop tags, keep line breaks, leave Turkish and English as written."""
    if not raw: return ""
    text=str(raw).replace("\r\n","\n").replace("\r","\n")
    text=re.sub(r"(?i)<br\s*/?>","\n",text)
    text=re.sub(r"(?i)</p\s*>","\n\n",text)
    text=re.sub(r"(?i)<p\b[^>]*>","",text)
    text=re.sub(r"<[^>]+>","",text)
    text=html.unescape(text).replace("\xa0"," ")
    text=re.sub(r"\n{3,}","\n\n","\n".join(ln.rstrip() for ln in text.split("\n"))).strip()
    if not re.search(r"[\w]",text,re.UNICODE): return ""
    return text

def review_id(url):
    m=re.search(r"/review/show/(\d+)",url or "")
    return m.group(1) if m else ""

def apply_review(entry, raw_review, raw_rating):
    """Attach written review text. Stars alone are not a review."""
    text=clean_review(raw_review)
    if not text:
        entry.pop("review",None); entry.pop("rating",None); return entry
    entry["review"]=text
    try: rating=int(str(raw_rating).strip() or 0)
    except ValueError: rating=0
    if 1<=rating<=5: entry["rating"]=rating
    else: entry.pop("rating",None)
    return entry

def goodreads_rss(uid):
    """Shelf RSS. Returns (books, ok). ok is False when the feed cannot be read.
    Goodreads retired these feeds in October 2026; a 404 is that, not an empty shelf."""
    books=[]; any_ok=False
    for shelf,status in (("read","read"),("currently-reading","reading")):
      seen=set(); shelf_ok=False
      for page in range(1,51):  # RSS returns ~100 items per page
        try:
            req=urllib.request.Request(f"https://www.goodreads.com/review/list_rss/{uid}?shelf={shelf}&page={page}",headers={"User-Agent":"reading-site/1.0"})
            root=ET.fromstring(urllib.request.urlopen(req,timeout=30).read())
            shelf_ok=True
        except Exception as e:
            print(f"Goodreads {shelf} p{page} failed: {e}", file=sys.stderr); break
        its=[i for i in root.iter("item") if (i.findtext("guid") or i.findtext("link")) not in seen]
        if not its: break
        for it in its:
            seen.add(it.findtext("guid") or it.findtext("link"))
            g=lambda t:(it.findtext(t) or "").strip()
            read_at=gr_date(g("user_read_at")); added=gr_date(g("user_date_added")) or gr_date(g("pubDate"))
            no_date=status=="read" and not read_at
            if no_date: read_at=added  # fallback if no read date set
            entry={"title":g("title"),"url":g("link"),"domain":g("author_name"),"category":"books","type":"Book",
                "status":status,"topics":[],"added":read_at if status=="read" else added,"read_at":read_at,"read_at_missing":no_date,
                "cover":g("book_large_image_url") or g("book_medium_image_url") or g("book_image_url")}
            apply_review(entry,g("user_review"),g("user_rating"))
            books.append(entry)
      any_ok=any_ok or shelf_ok
    if not any_ok: return [], False
    return [b for b in books if b["added"]], True

def _js_unescape(s):
    s=re.sub(r"\\u([0-9a-fA-F]{4})",lambda m:chr(int(m.group(1),16)),s)
    return s.replace("\\/","/").replace("\\n","\n").replace("\\r","\r").replace("\\t","\t").replace("\\'","'").replace('\\"','"').replace("\\\\","\\")

def _widget_html(uid, shelf, sort, order, num):
    wid=f"w{shelf}{sort}{order}{num}"
    q=urlencode({"shelf":shelf,"num_books":num,"sort":sort,"order":order,"show_author":1,"widget_id":wid})
    url=f"https://www.goodreads.com/review/custom_widget/{uid}.{shelf}?{q}"
    req=urllib.request.Request(url,headers={"User-Agent":"reading-site/1.0"})
    text=urllib.request.urlopen(req,timeout=60).read().decode("utf-8","replace")
    start=text.find("var widget_code = '")
    if start<0: raise ValueError("widget had no shelf html")
    start+=len("var widget_code = '")
    # The shelf is a single-quoted JS string closed just before `var widget_div`.
    marker=text.find("var widget_div", start)
    end=text.rfind("'", start, marker if marker>0 else None)
    if end<0: raise ValueError("widget string did not end")
    return html.unescape(_js_unescape(text[start:end]))

def _parse_widget(doc, shelf_status):
    out=[]
    parts=re.split(r'<div class="gr_custom_each_container[^"]*">', doc)
    for part in parts[1:]:
        hm=re.search(r'href="(https://www.goodreads.com/review/show/\d+[^"]*)"', part)
        tm=re.search(r'class="gr_custom_title[^"]*">\s*<a[^>]*>(.*?)</a>', part, re.S)
        am=re.search(r'class="gr_custom_author[^"]*">\s*by\s*<a[^>]*>(.*?)</a>', part, re.S)
        rm=re.search(r'class="gr_custom_review[^"]*">\s*(.*?)\s*</div>', part, re.S)
        cm=re.search(r'<img[^>]+src="([^"]+)"', part)
        rate=re.search(r'class="gr_custom_rating[^"]*">(.*?)</div>\s*<div class="gr_custom_title', part, re.S)
        rid=review_id(hm.group(1) if hm else "")
        if not rid or not tm: continue
        stars=len(re.findall(r"star_active", rate.group(1))) if rate else 0
        out.append({"id":rid,"title":clean_review(tm.group(1)),"author":clean_review(am.group(1) if am else ""),
            "review":rm.group(1) if rm else "","rating":stars,"status":shelf_status,
            "cover":(cm.group(1) if cm else "").replace("&amp;","&")})
    return out

def widget_by_id(uid):
    """Public shelf widget, the feed Goodreads left up after retiring RSS.
    Review text is hers; Goodreads cuts a long one at 240 characters and adds an ellipsis.
    Two date sorts cover shelves longer than the widget's 100-book cap."""
    found={}; views=(("read","date_read","d",100),("read","date_read","a",100),("read","review","d",100),("currently-reading","date_added","d",30))
    errors=0
    for shelf,sort,order,num in views:
        try: rows=_parse_widget(_widget_html(uid,shelf,sort,order,num),"read" if shelf=="read" else "reading")
        except Exception as e:
            errors+=1; print(f"Goodreads widget {shelf} {sort} {order} failed: {e}", file=sys.stderr); continue
        for row in rows:
            prev=found.get(row["id"])
            if not prev or (row["review"].strip() and not prev["review"].strip()): found[row["id"]]=row
            elif prev and row["status"]=="read": prev["status"]="read"
    if errors==len(views): return None
    return found

def _larger_cover(url):
    return re.sub(r"\._[A-Z]{2}\d+_","",url or "")

def merge_widget_reviews(books, uid):
    """Add review text onto the catalog. Does not rewrite titles, dates, covers, or status.
    A book with written text that is not in the catalog yet is added at the front, so it leads the undated list."""
    found=widget_by_id(uid)
    if found is None: return None
    seen=set()
    for b in books:
        rid=review_id(b.get("url"))
        if not rid or rid not in found: continue
        seen.add(rid)
        row=found[rid]
        apply_review(b,row["review"],row["rating"])
    stamp=datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    fresh=[]
    for rid,row in found.items():
        if rid in seen or not clean_review(row["review"]): continue
        entry={"title":row["title"],"url":f"https://www.goodreads.com/review/show/{rid}?utm_medium=api&utm_source=rss",
            "domain":row["author"],"category":"books","type":"Book","status":row["status"],"topics":[],
            "added":stamp,"read_at":stamp if row["status"]=="read" else None,
            "read_at_missing":row["status"]=="read","cover":_larger_cover(row["cover"])}
        apply_review(entry,row["review"],row["rating"])
        fresh.append(entry)
    # No read date from the widget, so these land in Undated. Put them first there.
    return fresh+books

def load_notion_rows():
    """Notion rows to rebuild data.json, or None to keep the file on disk."""
    if os.environ.get("NOTION_TOKEN"):
        return from_api()
    if os.path.exists("notion_raw.json"):
        return json.load(open("notion_raw.json"))["results"]
    return None

def main():
    rows = load_notion_rows()
    if rows is None:
        if not os.path.exists("data.json"):
            print("NOTION_TOKEN unset, no notion_raw.json, and no data.json", file=sys.stderr)
            sys.exit(1)
        kept = json.load(open("data.json"))
        print(f"NOTION_TOKEN unset; keeping committed data.json ({len(kept.get('items',[]))} items)", file=sys.stderr)
    else:
        items, skipped = [], []
        for r in rows:
            cat = TYPE_MAP.get(r.get("Type"))
            if not r.get("link") or not cat:
                skipped.append({"title":r["Title"],"type":r.get("Type"),"reason":"no URL" if not r.get("link") else "unmapped type"}); continue
            topics = r["Topics"] if isinstance(r["Topics"],list) else json.loads(r["Topics"] or "[]")
            items.append({"title":r["Title"],"url":r["link"],"domain":urlparse(r["link"]).netloc.removeprefix("www."),
                "category":cat,"type":r.get("Type"),"status":"read" if r.get("Status") in READ else "backlog" if r.get("Status") in BACKLOG else "excluded",
                "topics":topics,"added":r["Added"].replace(" ","T")[:19]+"Z",
                "read_at":(r.get("read") or r.get("date:Date read:start") or None)})
        items.sort(key=lambda i:i["added"], reverse=True)
        json.dump({"items":items},open("data.json","w"),indent=1,ensure_ascii=False)
        print(f"{len(items)} items, skipped {len(skipped)}:", file=sys.stderr)
        for s in skipped: print("  -",s,file=sys.stderr)
    uid=os.environ.get("GOODREADS_USER_ID","").strip() or "22282914"
    if not uid:
        print("no Goodreads user id: skipping books", file=sys.stderr)
    else:
        books, rss_ok=goodreads_rss(uid)
        if rss_ok:
            json.dump({"books":books},open("books.json","w"),indent=1,ensure_ascii=False)
            print(f"{len(books)} books from Goodreads RSS, {sum(1 for b in books if b.get('review'))} with reviews", file=sys.stderr)
        else:
            existing={"books":[]}
            if os.path.exists("books.json"): existing=json.load(open("books.json"))
            merged=merge_widget_reviews(list(existing.get("books") or []), uid)
            if merged is None:
                print(f"Goodreads unavailable; keeping books.json ({len(existing.get('books') or [])} books)", file=sys.stderr)
            else:
                json.dump({"books":merged},open("books.json","w"),indent=1,ensure_ascii=False)
                added=len(merged)-len(existing.get("books") or [])
                print(f"{len(merged)} books, {sum(1 for b in merged if b.get('review'))} with reviews, {added} new", file=sys.stderr)
if __name__=="__main__":
    main()
