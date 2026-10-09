// 编辑内容的保存状态与文章的公开状态分开显示；不触发自动保存。
export function editorSaveState({saving=false,kind="draft",failed=false,dirty=false,current=null}={}) {
  if (saving) return kind === "published" ? "正在发布…" : "正在保存草稿…";
  if (failed) return "保存失败 · 请重试";
  if (dirty) return "有未保存的修改";
  if (!current) return "尚未保存";
  return current.status === "draft" || current.has_draft ? "草稿已保存" : "已保存并发布";
}
