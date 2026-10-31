import "server-only";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { isProtectedWorkspaceStaging, isTrustedWorkspaceRequest } from "../../../../../../experiments/client-workspace-auth/src/workspace-runtime";

const HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "same-origin",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function unavailable() { return new Response(null, {status:404,headers:HEADERS}); }
async function emptyJsonBody(request:Request):Promise<boolean>{
  const lengthHeader=request.headers.get("content-length");
  if(lengthHeader!==null && (!/^\d+$/.test(lengthHeader)||Number(lengthHeader)>32)) return false;
  if(!request.body) return false;
  try{
    const reader=request.body.getReader();
    const chunks:Uint8Array[]=[];
    let size=0;
    try{
      while(true){
        const part=await reader.read();
        if(part.done)break;
        size+=part.value.byteLength;
        if(size>32){await reader.cancel();return false;}
        chunks.push(part.value);
      }
    }finally{try{reader.releaseLock();}catch{}}
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    const body:unknown=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
    return !!body && typeof body==="object" && !Array.isArray(body) && Object.keys(body).length===0;
  }catch{return false;}
}

/** Exact active project owners can approve a registered, MFA-ready invite. */
export async function POST(
  request: Request,
  context: {params: Promise<{attemptId:string}>},
): Promise<Response> {
  if (!isProtectedWorkspaceStaging() || !isTrustedWorkspaceRequest(request) ||
      request.headers.has("authorization") ||
      !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers.get("content-type") ?? "")) return unavailable();
  try {
    const {attemptId} = await context.params;
    if (!UUID.test(attemptId)) return unavailable();
    if (!(await emptyJsonBody(request))) return unavailable();
    const {approveEnrollmentGrantForVerifiedRequest} = await import(
      "../../../../../../experiments/client-workspace-auth/src/enrollment-saga"
    );
    const approved = await approveEnrollmentGrantForVerifiedRequest({
      headers: request.headers, attemptId,
    });
    return approved
      ? Response.json({approved:true},{status:200,headers:HEADERS})
      : unavailable();
  } catch { return unavailable(); }
}

export const GET = unavailable;
export const OPTIONS = unavailable;
export const HEAD = unavailable;
export const PUT = unavailable;
export const PATCH = unavailable;
export const DELETE = unavailable;
