const fs=require('fs');
const CH='UCwA7Aepp7nRUJNa8roQ-6Bw';
(async()=>{
 const html=await (await fetch(`https://www.youtube.com/channel/${CH}/videos?hl=en`,{headers:{'accept-language':'en-US','user-agent':'Mozilla/5.0'}})).text();
 const key=html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)[1];
 const cv=html.match(/"INNERTUBE_CLIENT_VERSION":"([^"]+)"/)[1];
 const init=JSON.parse(html.match(/var ytInitialData = (\{.*?\});<\/script>/s)[1]);
 const ctx={client:{clientName:'WEB',clientVersion:cv,hl:'en',gl:'US'}};
 function walk(o,out){if(!o||typeof o!=='object')return;if(o.richItemRenderer){out.items.push(o.richItemRenderer.content);return;}if(o.continuationItemRenderer){out.cont=o.continuationItemRenderer.continuationEndpoint?.continuationCommand?.token||out.cont;}for(const k in o)walk(o[k],out);}
 const tabs=init.contents.twoColumnBrowseResultsRenderer.tabs; const vt=tabs.find(t=>t.tabRenderer?.title==='Videos');
 let out={items:[],cont:null};walk(vt,out);let all=[...out.items],cont=out.cont;
 while(cont){const r=await (await fetch('https://www.youtube.com/youtubei/v1/browse?key='+key,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({context:ctx,continuation:cont})})).json();const o={items:[],cont:null};walk(r.onResponseReceivedActions,o);all.push(...o.items);cont=o.cont;}
 const vids=all.map(c=>{const v=c.videoRenderer;if(v)return{id:v.videoId,t:v.title.runs[0].text};const l=c.lockupViewModel;return{id:l.contentId,t:l.metadata.lockupMetadataViewModel.title.content};});
 for(let i=0;i<vids.length;i+=10){await Promise.all(vids.slice(i,i+10).map(async v=>{try{const r=await (await fetch('https://www.youtube.com/youtubei/v1/player?key='+key,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({context:ctx,videoId:v.id})})).json();v.s=+r.videoDetails?.lengthSeconds||0;}catch(e){v.s=0;}}));}
 fs.writeFileSync(process.argv[2],JSON.stringify(vids,null,0));
 console.log(vids.length, vids[0], vids[323], vids.filter(v=>!v.s).length+' without length');
})();
