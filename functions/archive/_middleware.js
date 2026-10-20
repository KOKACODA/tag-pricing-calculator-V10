// /archive/* —— 同事版历史归档（含企业定制品牌）仅作本仓库版本记录，不对外提供。
// v13.0：Pages 直传无 .assetsignore 忽略机制（该机制仅适用于 Workers Static Assets），
// 故用 Pages Functions 中间件拦截 /archive/* 并返回 404（Functions 优先于静态资源）。
export async function onRequest() {
  return new Response("Not Found", {
    status: 404,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "x-robots-tag": "noindex, nofollow"
    }
  });
}
