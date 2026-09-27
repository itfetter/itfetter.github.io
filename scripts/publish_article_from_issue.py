#!/usr/bin/env python3
"""把仓库所有者提交的文章表单写成 Jekyll 文章，并主动请求 Pages 构建。"""
import base64
import datetime as dt
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from zoneinfo import ZoneInfo

OWNER_ID = 138357073
PREFIX = "[发布文章] "
API = "https://api.github.com"
TOKEN = os.environ["GH_TOKEN"]
REPO = os.environ["GITHUB_REPOSITORY"]
HEADERS = {
    "Accept": "application/vnd.github+json",
    "Authorization": "Bearer " + TOKEN,
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
}


def api(method, path, data=None):
    payload = json.dumps(data, ensure_ascii=False).encode("utf-8") if data is not None else None
    request = urllib.request.Request(API + path, data=payload, headers=HEADERS, method=method)
    with urllib.request.urlopen(request, timeout=30) as response:
        content = response.read()
        return json.loads(content) if content else {}


def comment(number, message):
    api("POST", f"/repos/{REPO}/issues/{number}/comments", {"body": message})


def fields_from_form(text):
    # GitHub Issue Form 将各输入项输出为 ### 标签。正文后续的 Markdown 标题原样保留。
    head = re.search(r"(?m)^### 分类\s*$", text)
    summary = re.search(r"(?m)^### 摘要\s*$", text)
    body = re.search(r"(?m)^### 正文\s*$", text)
    if not head or not summary or not body or not (head.end() < summary.start() < body.start()):
        raise ValueError("文章表单字段不完整，请用仓库的「发布博客文章」表单重新提交。")
    category = text[head.end():summary.start()].strip()
    excerpt = text[summary.end():body.start()].strip()
    markdown = text[body.end():].strip()
    if not category or not excerpt or not markdown:
        raise ValueError("分类、摘要和正文都必须填写。")
    if any(len(value) > limit for value, limit in ((category, 80), (excerpt, 300), (markdown, 300000))):
        raise ValueError("文章字段过长。")
    return category, excerpt, markdown


def main():
    with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as handle:
        issue = json.load(handle)["issue"]
    number = issue["number"]
    if issue["user"]["id"] != OWNER_ID or not issue["title"].startswith(PREFIX):
        raise ValueError("只有仓库所有者使用指定文章表单才能发布。")
    title = issue["title"][len(PREFIX):].strip()
    if not title or len(title) > 160:
        raise ValueError("请在 [发布文章] 后填写不超过 160 字的标题。")
    category, excerpt, markdown = fields_from_form(issue["body"] or "")
    now = dt.datetime.now(ZoneInfo("Asia/Shanghai"))
    date = now.strftime("%Y-%m-%d")
    slug = f"article-{number}"
    path = f"_posts/{date}-{slug}.md"
    quoted = lambda value: json.dumps(value, ensure_ascii=False)
    article = (
        "---\nlayout: post\n"
        f"title: {quoted(title)}\n"
        f"category: {quoted(category)}\n"
        f"summary: {quoted(excerpt)}\n"
        f"blog_id: {slug}\n"
        f"date: {now.strftime('%Y-%m-%d %H:%M:%S %z')}\n"
        f"permalink: /articles/{slug}/\n"
        "---\n\n" + markdown + "\n"
    )
    encoded_path = urllib.parse.quote(path, safe="/")
    try:
        api("PUT", f"/repos/{REPO}/contents/{encoded_path}", {
            "message": f"发布文章：{title}",
            "content": base64.b64encode(article.encode("utf-8")).decode("ascii"),
            "branch": "main",
        })
    except urllib.error.HTTPError as error:
        if error.code == 422:
            raise ValueError(f"目标文章文件已存在：{path}；请检查 Issue #{number}。") from error
        raise
    # GITHUB_TOKEN 提交不触发分支模式下的 Pages 构建，显式请求构建。
    api("POST", f"/repos/{REPO}/pages/builds")
    url = f"https://itfetter.com/articles/{slug}/"
    comment(number, f"已生成 `{path}`，并已请求 GitHub Pages 构建。部署完成后访问：{url}\n\n若页面尚未出现，请查看仓库 Actions 中的 Pages 构建结果。")
    api("PATCH", f"/repos/{REPO}/issues/{number}", {"state": "closed"})
    print(f"文章已提交并请求 Pages 构建：{url}")


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(f"发布失败：{error}", file=sys.stderr)
        try:
            with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as handle:
                number = json.load(handle)["issue"]["number"]
            comment(number, f"自动发布失败：{error}\n\n请检查本次 Actions 日志。")
        except Exception as notice_error:
            print(f"无法回写错误消息：{notice_error}", file=sys.stderr)
        raise
