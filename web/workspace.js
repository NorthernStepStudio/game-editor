import { api, el, notice } from './api.js';
const $=id=>document.getElementById(id);
export function initWorkspace() {
  let projectId='',file=null,review=null,generation=0,busy=false;
  const query=params=>new URLSearchParams({projectId,...params}).toString();
  const showError=e=>notice(e);
  function controls() {
    $('workspace-editor').disabled=!file||busy;
    $('workspace-stage').disabled=!file||busy;
    for(const button of document.querySelectorAll('[data-assist]'))button.disabled=!file||busy;
    $('workspace-project').disabled=busy;
  }
  function resetFile() {file=null;review=null;$('workspace-editor').value='';$('workspace-file-title').textContent='Open a file';$('workspace-review').hidden=true;$('workspace-answer').hidden=true;controls();}
  window.addEventListener('workspace-projects',event=>{
    const select=$('workspace-project');select.replaceChildren(new Option('Choose a project',''));
    for(const p of event.detail)select.add(new Option(p.name,p.id));
  });
  async function openFile(path) {
    if(busy)return;const ticket=++generation;
    const data=await api(`/api/workspace/file?${query({path})}`);if(ticket!==generation)return;
    file=data;$('workspace-file-title').textContent=data.path;$('workspace-editor').value=data.content;$('workspace-answer').hidden=true;controls();
  }
  function fileButton(path,label=path) {const button=el('button',label,'file-button');button.onclick=()=>openFile(path).catch(showError);return button;}
  async function browse() {
    if(!projectId)return;const ticket=++generation;
    const data=await api(`/api/workspace/files?${query({})}`);if(ticket!==generation)return;
    $('workspace-files').replaceChildren(...data.files.map(path=>fileButton(path)));
    $('workspace-scope').textContent=`${data.files.length} source files${data.truncated?' (listing limit reached)':''}. Hidden, generated, and credential paths are excluded.`;
  }
  async function loadReviews() {
    if(!projectId)return;const project=projectId;const data=await api(`/api/workspace/reviews?${query({})}`);if(project!==projectId)return;
    $('workspace-reviews').replaceChildren();
    for(const item of data.reviews){const button=el('button',`${item.path} · ${item.status}`,'file-button');button.onclick=async()=>{if(busy)return;try{const r=await api(`/api/workspace/review?id=${encodeURIComponent(item.id)}`);if(r.projectId===projectId)showReview(r);}catch(e){showError(e);}};$('workspace-reviews').append(button);}
    if(!data.reviews.length)$('workspace-reviews').append(el('p','No proposals for this project yet.','muted'));
    if(data.unavailable)$('workspace-reviews').append(el('p',`${data.unavailable} review records could not be loaded. Check the server's review storage.`,'muted'));
  }
  function showReview(value) {
    review=value;$('workspace-review').hidden=false;$('workspace-review-title').textContent=value.path;
    $('workspace-before').textContent=value.before;$('workspace-after').textContent=value.after;$('workspace-review-status').textContent=value.status;
    const actions=$('workspace-review-actions');actions.replaceChildren();
    for(const [action,label] of value.status==='pending'?[['apply','Approve and apply'],['reject','Reject proposal']]:value.status==='applied'?[['restore','Restore original file']]:[]){
      const button=el('button',label);button.onclick=()=>act(action).catch(showError);actions.append(button);
    }
  }
  async function act(action) {
    if(busy||!review)return;busy=true;generation++;controls();for(const b of $('workspace-review-actions').querySelectorAll('button'))b.disabled=true;
    try {const updated=await api(`/api/workspace/${action}`,{id:review.id});showReview(updated);await loadReviews();if(file?.path===updated.path&&action!=='reject'){const fresh=await api(`/api/workspace/file?${query({path:updated.path})}`);file=fresh;$('workspace-editor').value=fresh.content;}}
    finally {busy=false;controls();for(const b of $('workspace-review-actions').querySelectorAll('button'))b.disabled=false;}
  }
  $('workspace-project').onchange=async()=>{if(busy)return;projectId=$('workspace-project').value;generation++;resetFile();$('workspace-files').replaceChildren();$('workspace-reviews').replaceChildren();try{await browse();await loadReviews();}catch(e){showError(e);}};
  $('workspace-refresh').onclick=()=>browse().catch(showError);
  $('workspace-search-form').onsubmit=async event=>{event.preventDefault();if(!projectId)return;const ticket=++generation;try{const data=await api(`/api/workspace/search?${query({q:$('workspace-query').value})}`);if(ticket!==generation)return;$('workspace-files').replaceChildren(...data.matches.map(m=>fileButton(m.path,`${m.path}:${m.line} — ${m.text}`)));$('workspace-scope').textContent=`${data.matches.length} matches${data.truncated?' (limit reached)':''}; ${data.skipped} unreadable, sensitive, or oversized files skipped.`;}catch(e){showError(e);}};
  $('workspace-stage').onclick=async()=>{if(!file||busy)return;busy=true;generation++;controls();try{showReview(await api('/api/workspace/stage',{projectId,path:file.path,version:file.version,content:$('workspace-editor').value}));await loadReviews();}catch(e){showError(e);}finally{busy=false;controls();}};
  for(const button of document.querySelectorAll('[data-assist]'))button.onclick=async()=>{
    if(!file||busy)return;
    if($('workspace-editor').value!==file.content){showError(new Error('Review and apply or discard your manual edits before asking for file assistance.'));return;}
    busy=true;generation++;controls();$('workspace-answer').hidden=false;$('workspace-answer').textContent='Matterhorn is working…';
    try{const answer=await api('/api/workspace/assist',{projectId,path:file.path,version:file.version,intent:button.dataset.assist,prompt:$('workspace-prompt').value,provider:$('provider').value});$('workspace-answer').textContent=answer.response;if(answer.review){showReview(answer.review);await loadReviews();}else if(['propose','diagnose'].includes(button.dataset.assist))$('workspace-answer').textContent+='\n\nNo concrete edit was returned. Nothing was changed.';}
    catch(e){$('workspace-answer').textContent='Assistance failed; no edit was applied.';showError(e);}finally{busy=false;controls();}
  };
}
