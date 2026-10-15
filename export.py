#!/usr/bin/env python3
"""Build data.json for the reading site.
With NOTION_TOKEN (internal integration shared with the Reading List DB)
and optional NOTION_DATA_SOURCE_ID, queries the Notion API. Otherwise reads
notion_raw.json when that file exists. If neither is available, keeps the
committed data.json so a rebuild can deploy without a token.
Goodreads uses GOODREADS_USER_ID, defaulting to 22282914.
Private fields (My notes, For, Why it matters, Added by) are never written."""
import json, os, sys, urllib.request, email.utils
import xml.etree.ElementTree as ET
from urllib.parse import urlparse
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

def goodreads():
    uid=os.environ.get("GOODREADS_USER_ID","").strip() or "22282914"
    if not uid:
        print("no Goodreads user id: skipping books", file=sys.stderr); return []
    books=[]
    for shelf,status in (("read","read"),("currently-reading","reading")):
      seen=set()
      for page in range(1,51):  # RSS returns ~100 items per page
        try:
            req=urllib.request.Request(f"https://www.goodreads.com/review/list_rss/{uid}?shelf={shelf}&page={page}",headers={"User-Agent":"reading-site/1.0"})
            root=ET.fromstring(urllib.request.urlopen(req,timeout=30).read())
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
            books.append({"title":g("title"),"url":g("link"),"domain":g("author_name"),"category":"books","type":"Book",
                "status":status,"topics":[],"added":read_at if status=="read" else added,"read_at":read_at,"read_at_missing":no_date,
                "cover":g("book_large_image_url") or g("book_medium_image_url") or g("book_image_url")})
    return [b for b in books if b["added"]]

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
    books=goodreads()
    if books or not os.path.exists("books.json"):
        json.dump({"books":books},open("books.json","w"),indent=1,ensure_ascii=False)
    print(f"{len(books)} books", file=sys.stderr)
main()
