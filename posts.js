---
layout: null
---
/* 本文件由 GitHub Pages 的 Jekyll 从 _posts/*.md 自动生成，请编辑对应 Markdown 文章。 */
const posts = [
{% for post in site.posts reversed %}
  {
    id: {{ post.blog_id | jsonify }},
    title: {{ post.title | jsonify }},
    category: {{ post.category | jsonify }},
    date: {{ post.date | date: "%Y.%m" | jsonify }},
    summary: {{ post.summary | jsonify }},
    html: {{ post.content | jsonify }},
    source: {{ post.path | jsonify }}
  }{% unless forloop.last %},{% endunless %}
{% endfor %}
];
