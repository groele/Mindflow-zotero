/* Runs only in a temporary Zotero profile. Never included in the release XPI. */
(async () => {
  const results = [];
  const restartStatePath = PathUtils.join(Zotero.DataDirectory.dir, 'native-restart-state.json');
  const restarting = await IOUtils.exists(restartStatePath);
  const reportPath = PathUtils.join(Zotero.DataDirectory.dir, restarting ? 'native-restart-results.json' : 'native-regression-results.json');
  const report = async () => IOUtils.writeUTF8(reportPath, JSON.stringify({ version: Zotero.version,
    dataDirectory: Zotero.DataDirectory.dir, results }, null, 2));
  const check = (ok, message) => { if (!ok) throw new Error(message); };
  const waitFor = async (fn, description, timeout = 30000) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const value = await fn(); if (value) return value;
      await Zotero.Promise.delay(100);
    }
    throw new Error('Timeout: ' + description);
  };
  const run = async (name, fn) => {
    try { await fn(); results.push({ name, pass: true }); }
    catch (error) {
      const w=Zotero.getMainWindow(),tabs=w?.Zotero_Tabs;
      results.push({ name, pass: false, error: String(error), stack: error.stack,
        tabs:tabs?._tabs.map(t=>{const frame=tabs.getTabContent(t.id)?.querySelector('iframe');return {id:t.id,docId:t.data?.docId,
          uri:frame?.contentDocument?.documentURI,body:frame?.contentDocument?.body?.innerText?.slice(0,300),mode:frame?._mindflowInitialAction?.mode};}) });
    }
    await report();
  };
  try {
    await waitFor(() => Zotero.getMainWindow()?.Zotero_Tabs, 'main window');
    const win = Zotero.getMainWindow();
    const host = Zotero.MindFlow;
    check(host, 'Plugin runtime was not initialized');
    check(Zotero.DataDirectory.dir.includes('native-test-'), 'Test data directory isolation failed');
    Zotero.Prefs.set('extensions.mindflow.showWelcomeOnStartup', false, true);
    Zotero.Prefs.set('extensions.mindflow.autoArchiveToItem', false, true);
    const tabs = win.Zotero_Tabs;
    const workspaceIds = async () => (await IOUtils.getChildren(PathUtils.join(Zotero.DataDirectory.dir,'mindflow','workspace')))
      .map(p=>PathUtils.filename(p)).filter(n=>n.startsWith('mindflow_doc_') && n.endsWith('.json')).sort();
    if (restarting) {
      const expected=JSON.parse(await IOUtils.readUTF8(restartStatePath));
      await run('real Zotero process restart restores every saved workspace tab ID', async () => {
        await waitFor(()=>expected.tabs.every(e=>tabs._tabs.some(t=>t.type==='mindflow' && t.data.docId===e.docId)),'all session tabs restored');
        check(tabs._tabs.filter(t=>t.type==='mindflow').length===expected.tabs.length,'session duplicated or lost a tab');
      });
      await run('restart loads canonical saved titles, tree contents and exact attachment sources', async () => {
        for(const e of expected.tabs) {
          const tab=await waitFor(()=>tabs._tabs.find(t=>t.type==='mindflow' && t.data.docId===e.docId),'restored document '+e.docId);
          const frame=tabs.getTabContent(tab.id).querySelector('iframe');
          await waitFor(()=>frame.contentDocument.querySelector('header input')?.value===e.title,'saved title '+e.title);
          const doc=JSON.parse(await host.workspaceStorage('get',{key:`mindflow_doc_${e.docId}`}));
          check(doc.root.text===e.rootText && (doc.metadata?.zoteroAttachmentKey || null)===e.source,'restart source or tree mismatch');
          if(e.source) check(tab.data.targetItemId===`attachment:${doc.metadata.zoteroAttachmentLibraryID}:${e.source}`,'restart attachment target mismatch');
        }
        check(JSON.stringify(await workspaceIds())===JSON.stringify(expected.workspaceIds),'restart imported or cloned a canonical workspace record');
      });
      await run('restart creates no additional archives under the source papers', async () => {
        for(const e of expected.papers) {
          const item=host.resolveItemReference(e.key,e.libraryID);check(item,'source paper missing');
          check(host.getMindflowAttachments(item).length===e.count,'restart created duplicate attachment');
        }
      });
      await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir,'native-restart-done.txt'),'done');
      Services.startup.quit(Services.startup.eAttemptQuit);return;
    }
    const paper = async title => { const item = new Zotero.Item('journalArticle'); item.setField('title', title); await item.saveTx(); return item; };
    const a = await paper('MindFlow Native Test Paper A');
    const b = await paper('MindFlow Native Test Paper B');
    const map = title => ({id:'doc_collision_native',title,root:{id:'root_native',text:title,children:[]},revision:1,
      createdAt:10,updatedAt:100,themeId:'classic-blue',layoutType:'mindmap',metadata:{autoSyncToZotero:false}});
    const attachment = async (parent, document) => {
      const file = PathUtils.join(Zotero.DataDirectory.dir, `${parent.key}-${document.title.replace(/\W/g,'')}.mindflow`);
      await IOUtils.writeUTF8(file,JSON.stringify(document));
      return Zotero.Attachments.importFromFile({file,parentItemID:parent.id,title:document.title+'.mindflow'});
    };
    const aa = await attachment(a,map('Native Map A'));
    const bb = await attachment(b,map('Native Map B'));
    const frameFor = id => tabs.getTabContent(id)?.querySelector('iframe');
    const titleFor = id => frameFor(id)?.contentDocument?.querySelector('header input')?.value;
    let tabA, tabB;
    await run('A opens its exact attachment', async () => {
      await host.openMindflowAttachment(aa,win);tabA=tabs.selectedID;
      await waitFor(()=>titleFor(tabA)==='Native Map A','A document visible');
      check(tabs._tabs.find(t=>t.id===tabA).data.targetItemId===`attachment:${aa.libraryID}:${aa.key}`,'A routing mismatch');
    });
    await run('B with the same document ID shows B and isolates A', async () => {
      tabs.select('zotero-pane'); await host.openMindflowAttachment(bb,win);tabB=tabs.selectedID;
      await waitFor(()=>titleFor(tabB)==='Native Map B','B document visible');
      check(tabA!==tabB,'Same ID reused A tab');check(titleFor(tabA)==='Native Map A','A was overwritten');
    });
    await run('settings reload cannot replace A with global active B', async () => {
      const stored=JSON.parse(Zotero.Prefs.get('mindflow.mindflow_app_settings',true)||'{}');
      Zotero.Prefs.set('mindflow.mindflow_app_settings',JSON.stringify({...stored,zoteroIncludeAbstract:false}),true);
      await Zotero.Promise.delay(1000);check(titleFor(tabA)==='Native Map A','A changed after settings reload');
      check(titleFor(tabB)==='Native Map B','B changed after settings reload');
    });
    await run('A→B→A reopen preserves edited content', async () => {
      const frame=frameFor(tabA),input=frame.contentDocument.querySelector('header input');
      const setter=Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype,'value').set;
      setter.call(input,'Native A Edited');input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
      await waitFor(()=>titleFor(tabA)==='Native A Edited','edited title');await Zotero.Promise.delay(1200);
      tabs.select('zotero-pane');await host.openMindflowAttachment(aa,win);
      check(tabs.selectedID===tabA,'A did not reuse exact tab');check(titleFor(tabA)==='Native A Edited','A edits discarded');
    });
    await run('icon has no adjacent MindFlow brand text', async () => {
      const header=frameFor(tabA).contentDocument.querySelector('header');
      check(![...header.querySelectorAll('span')].some(n=>n.textContent.trim()==='MindFlow'),'Brand label still visible');
      const button=win.document.getElementById('mindflow-toolbar-button');
      check(button && !button.getAttribute('label'),'Native toolbar label remains');
    });
    await run('close and reopen B reuses its isolated workspace ID', async () => {
      const before=tabs._tabs.find(t=>t.id===tabB).data.docId;tabs.close(tabB);
      await host.openMindflowAttachment(bb,win);tabB=tabs.selectedID;
      await waitFor(()=>titleFor(tabB)==='Native Map B','B reopened');
      check(tabs._tabs.find(t=>t.id===tabB).data.docId===before,'Repeated open produced another collision copy');
    });
    await run('forceNew creates another map for the same paper', async () => {
      host.openMindFlow({mode:'create_from_selection',items:[a],forceNew:true},win);const first=tabs.selectedID;
      await waitFor(()=>titleFor(first)?.includes(a.getField('title')),'new map for A');
      host.openMindFlow({mode:'create_from_selection',items:[a],forceNew:true},win);const second=tabs.selectedID;
      await waitFor(()=>titleFor(second)?.includes(a.getField('title')),'second new map for A');
      check(first!==second,'forceNew reused first tab');
      await waitFor(()=>host.getMindflowAttachments(a).length>=3,'both new maps archived under A');
      await host._archiveWriteQueue;
      await waitFor(()=>tabs._tabs.find(t=>t.id===first).data.docId && tabs._tabs.find(t=>t.id===second).data.docId,'created map IDs synchronized');
      check(tabs._tabs.find(t=>t.id===first).data.docId!==tabs._tabs.find(t=>t.id===second).data.docId,'created maps share a document ID');
    });
    await run('archived file contents are registered under exact parents', async () => {
      for(const p of [a,b]) for(const att of host.getMindflowAttachments(p)) {
        check(att.parentItemID===p.id && att.libraryID===p.libraryID,'wrong attachment parent');
        const doc=JSON.parse(await IOUtils.readUTF8(await att.getFilePathAsync()));check(doc.root?.id && doc.id,'invalid archived map');
      }
    });
    await run('same-parent maps open separate exact tabs', async () => {
      const maps=host.getMindflowAttachments(a);
      check(maps.length>=3,'maps missing');
      const ids=[];
      for(const att of maps.slice(-2)) { await host.openMindflowAttachment(att,win);ids.push(tabs.selectedID); }
      check(ids[0]!==ids[1],'different maps under A reused one tab');
    });
    await run('standalone A and B remain separate with same embedded ID', async () => {
      Zotero.Prefs.set('extensions.mindflow.windowMode','window',true);
      await host.openMindflowAttachment(aa,win);
      const windowA=await waitFor(()=>host._standaloneWindows?.get(`attachment:${aa.libraryID}:${aa.key}`),'window A');
      await waitFor(()=>windowA.document?.querySelector('header input')?.value==='Native A Edited','window A contents');
      await host.openMindflowAttachment(bb,win);
      const windowB=await waitFor(()=>host._standaloneWindows?.get(`attachment:${bb.libraryID}:${bb.key}`),'window B');
      await waitFor(()=>windowB.document?.querySelector('header input')?.value==='Native Map B','window B contents');
      check(windowA!==windowB,'windows collided');
      await host.openMindflowAttachment(aa,win);
      check(host._standaloneWindows.get(`attachment:${aa.libraryID}:${aa.key}`)===windowA,
        'A window duplicated: '+JSON.stringify([...host._standaloneWindows].map(([key,w])=>({key,closed:w.closed,title:w.document?.title,same:w===windowA}))));
      windowA.close();windowB.close();
      Zotero.Prefs.set('extensions.mindflow.windowMode','tab',true);
    });
    await run('native item-pane registration exists and toolbar accessible name is retained', async () => {
      check(host.itemPaneSectionID,'item pane missing');
      const button=win.document.getElementById('mindflow-toolbar-button');
      check(button.getAttribute('aria-label')==='MindFlow' && button.getAttribute('tooltiptext'),'toolbar lacks accessible name');
    });
    await run('typing then immediate native tab close retains the latest title', async () => {
      tabs.select(tabA);
      const frame=frameFor(tabA),input=frame.contentDocument.querySelector('header input');
      const setter=Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype,'value').set;
      setter.call(input,'Native A Immediate Close');input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
      await waitFor(()=>titleFor(tabA)==='Native A Immediate Close','title committed by React');
      tabs.close(tabA);
      await Zotero.Promise.delay(600);
      await host._workspaceWriteQueue;
      await host.openMindflowAttachment(aa,win);tabA=tabs.selectedID;
      await waitFor(()=>titleFor(tabA),'A reopens after close');
      check(titleFor(tabA)==='Native A Immediate Close','latest typing lost: '+titleFor(tabA));
    });
    await run('header groups do not overlap at native 1000px window width', async () => {
      const header=frameFor(tabA).contentDocument.querySelector('header');
      const boxes=[...header.children].filter(n=>n.tagName!=='INPUT').map(n=>n.getBoundingClientRect()).filter(r=>r.width&&r.height);
      for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++) {
        const a=boxes[i],b=boxes[j];
        check(Math.min(a.right,b.right)<=Math.max(a.left,b.left)+1 || Math.min(a.bottom,b.bottom)<=Math.max(a.top,b.top)+1,'header groups overlap');
      }
    });
    await run('native undo-close restores the latest local document, not initial payload', async () => {
      const before=tabs._tabs.find(t=>t.id===tabA).data.docId;
      tabs.close(tabA);await tabs.undoClose();
      tabA=tabs._tabs.find(t=>t.type==='mindflow' && t.data.docId===before)?.id;
      check(tabA,'undo-close did not recreate MindFlow tab');
      await waitFor(()=>titleFor(tabA)==='Native A Immediate Close','undo-close latest contents');
    });
    await run('session restore hook reopens saved identity without creating another map', async () => {
      const record=tabs._tabs.find(t=>t.id===tabB),data={...record.data};
      const count=host.getMindflowAttachments(b).length;
      tabs.close(tabB);
      await tabs.tabHooks.restoreState.mindflow({type:'mindflow',data,selected:true},2);
      tabB=tabs._tabs.find(t=>t.type==='mindflow' && t.data.docId===data.docId)?.id;
      check(tabB,'session restore created no tab');await waitFor(()=>titleFor(tabB)==='Native Map B','restored B');
      check(host.getMindflowAttachments(b).length===count,'session restore archived a duplicate');
    });
    await run('rapid workspace B→A selection cannot finish on stale B', async () => {
      tabs.select(tabA);
      const frame=frameFor(tabA),document=frame.contentDocument;
      document.querySelector('button[title="文档库 (Documents)"]').click();
      const row = title => [...document.querySelectorAll('span')].find(n=>n.textContent===title)?.closest('div.group');
      await waitFor(()=>row('Native Map B') && row('Native A Immediate Close'),'document rows');
      const original=host.workspaceStorage;
      const bId=tabs._tabs.find(t=>t.id===tabB).data.docId;
      host.workspaceStorage=async function(action,payload) {
        if(action==='get' && payload.key===`mindflow_doc_${bId}`) await Zotero.Promise.delay(200);
        return original.call(this,action,payload);
      };
      try {
        row('Native Map B').click();await Zotero.Promise.delay(20);row('Native A Immediate Close').click();
        await Zotero.Promise.delay(600);check(titleFor(tabA)==='Native A Immediate Close','slower B replaced latest A selection');
      } finally { host.workspaceStorage=original; }
    });
    await run('native insertion, undo and redo modify the correct root', async () => {
      const frame=frameFor(tabA),document=frame.contentDocument;
      document.querySelector('button[title="插入子主题 (Tab)"]').click();
      await Zotero.Promise.delay(200);
      const capture=frame.contentWindow.wrappedJSObject._mindflowCaptureState;
      check(capture()?.doc.root.children.length===1,'child was not inserted');
      document.querySelector('button[title="撤销 (Ctrl+Z)"]').click();await Zotero.Promise.delay(100);
      const docId=tabs._tabs.find(t=>t.id===tabA).data.docId;
      const state=capture()?.doc || JSON.parse(await host.workspaceStorage('get',{key:`mindflow_doc_${docId}`}));
      check(state.root.children.length===0,'undo did not revert correct document');
      document.querySelector('button[title="重做 (Ctrl+Y)"]').click();await Zotero.Promise.delay(100);
      check(capture()?.doc.root.children.length===1,'redo did not restore child');
    });
    await run('uncommitted node text survives closing before Enter or blur', async () => {
      const frame=frameFor(tabA),document=frame.contentDocument;
      const span=document.querySelector('span[title="Native Map A"]');check(span,'root label missing');
      span.dispatchEvent(new frame.contentWindow.MouseEvent('dblclick',{bubbles:true}));
      const input=await waitFor(()=>document.querySelector('input[data-mindflow-node-draft="root_native"]'),'root editor');
      Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype,'value').set.call(input,'Native Root Closing Draft');
      input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
      await Zotero.Promise.delay(50);tabs.close(tabA);await host._closeSaveQueue;
      await host.openMindflowAttachment(aa,win);tabA=tabs.selectedID;
      await waitFor(()=>frameFor(tabA)?.contentDocument?.querySelector('span[title="Native Root Closing Draft"]'),'closed root draft reopened');
    });
    await run('native delete is revision guarded and blocks queued stale archive', async () => {
      const saved=await host.workspaceStorage('commitDocument',{doc:{...map('Delete test'),id:'native_delete'},expectedRevision:0});
      await host.workspaceStorage('deleteDocument',{id:saved.id,expectedRevision:saved.revision});
      check(await host.workspaceStorage('get',{key:'mindflow_doc_native_delete'})===null,'deleted document readable');
      let conflict=false;
      try {await host.workspaceStorage('commitDocument',{doc:saved,expectedRevision:0});} catch(e) {conflict=String(e).includes('CONFLICT');}
      check(conflict,'stale writer resurrected deletion');
      const result=await host.saveMindMapToItem({doc:saved,parentItemKey:a.key});check(!result.success,'deleted map was archived');
    });
    await run('standalone immediate close is saved by host and survives reopen', async () => {
      Zotero.Prefs.set('extensions.mindflow.windowMode','window',true);
      try {
        await host.openMindflowAttachment(aa,win);
        const target=`attachment:${aa.libraryID}:${aa.key}`;
        const w=await waitFor(()=>host._standaloneWindows.get(target),'standalone ready');
        const input=await waitFor(()=>w.document.querySelector('header input'),'standalone editor');
        Object.getOwnPropertyDescriptor(w.HTMLInputElement.prototype,'value').set.call(input,'Native Standalone Close');
        input.dispatchEvent(new w.Event('input',{bubbles:true}));await Zotero.Promise.delay(50);w.close();
        await host._closeSaveQueue;
        await host.openMindflowAttachment(aa,win);
        const reopened=await waitFor(()=>host._standaloneWindows.get(target),'standalone reopened');
        await waitFor(()=>reopened.document.querySelector('header input')?.value==='Native Standalone Close','standalone saved title');
        reopened.close();
      } finally {Zotero.Prefs.set('extensions.mindflow.windowMode','tab',true);}
    });
    await run('native stale editor becomes detached conflict copy after another window saves', async () => {
      const originalId=tabs._tabs.find(t=>t.id===tabA).data.docId;
      const frame=frameFor(tabA),input=frame.contentDocument.querySelector('header input');
      Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype,'value').set.call(input,'Native Main Conflict');
      input.dispatchEvent(new frame.contentWindow.Event('input',{bubbles:true}));
      await waitFor(()=>titleFor(tabA)?.includes('冲突副本'),'conflict copy visible');
      await waitFor(()=>tabs._tabs.find(t=>t.id===tabA).data.docId!==originalId,'conflict routing updated');
      const copyId=tabs._tabs.find(t=>t.id===tabA).data.docId;
      const copy=JSON.parse(await host.workspaceStorage('get',{key:`mindflow_doc_${copyId}`}));
      check(copy.metadata.autoSyncToZotero===false && !copy.metadata.zoteroAttachmentKey && !copy.metadata.zoteroItemKey,'conflict copy retained dangerous binding');
      check(JSON.parse(await host.workspaceStorage('get',{key:`mindflow_doc_${originalId}`})).title==='Native Standalone Close','original overwritten by stale editor');
    });
    await run('native corrupt primary recovers matching backup before next verified write', async () => {
      const first=await host.workspaceStorage('commitDocument',{doc:{...map('Recovery original'),id:'native_recovery'},expectedRevision:0});
      await host.workspaceStorage('commitDocument',{doc:{...first,title:'Recovery second'},expectedRevision:first.revision});
      const file=PathUtils.join(Zotero.DataDirectory.dir,'mindflow','workspace','mindflow_doc_native_recovery.json');
      await IOUtils.writeUTF8(file,'{corrupt');
      const recovered=JSON.parse(await host.workspaceStorage('get',{key:'mindflow_doc_native_recovery'}));
      check(recovered.title==='Recovery original','backup was not used');
      await host.workspaceStorage('commitDocument',{doc:{...recovered,title:'Recovery verified'},expectedRevision:recovered.revision});
      check(JSON.parse(await IOUtils.readUTF8(file)).title==='Recovery verified','recovered file not saved');
      check((await IOUtils.getChildren(PathUtils.parent(file))).some(p=>p.startsWith(file+'.corrupt-')),'damaged original was discarded');
    });
    await run('native concurrent snapshots retain both versions in durable files', async () => {
      const snapshot=id=>({id,docId:'native_snapshots',title:id,timestamp:Date.now(),data:JSON.stringify({...map(id),id:'native_snapshots'})});
      await Promise.all(['native_s1','native_s2'].map(id=>host.workspaceStorage('mutateSnapshots',{docId:'native_snapshots',snapshots:[snapshot(id)]})));
      const saved=JSON.parse(await host.workspaceStorage('get',{key:'mindflow_snapshots_native_snapshots'}));
      check(saved.length===2,'one concurrent snapshot was lost');
    });
    try {
      tabs.select(tabA);
      const canvas=win.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
      canvas.width=win.innerWidth;canvas.height=win.innerHeight;
      canvas.getContext('2d').drawWindow(win,0,0,canvas.width,canvas.height,'rgb(255,255,255)');
      const binary=win.atob(canvas.toDataURL('image/png').split(',')[1]);
      await IOUtils.write(PathUtils.join(Zotero.DataDirectory.dir,'native-ui.png'),Uint8Array.from(binary,c=>c.charCodeAt(0)));
    } catch(error) { await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir,'screenshot-note.txt'),String(error)); }
    await host._closeSaveQueue;await host._archiveWriteQueue;
    const expectedTabs=[];
    for(const tab of tabs._tabs.filter(t=>t.type==='mindflow')) {
      const doc=JSON.parse(await host.workspaceStorage('get',{key:`mindflow_doc_${tab.data.docId}`}));
      expectedTabs.push({docId:doc.id,title:doc.title,rootText:doc.root.text,source:doc.metadata?.zoteroAttachmentKey || null});
    }
    // Deliberately leave the last keystrokes inside the 600ms debounce window.
    // The second process must see them; don't flush explicitly in this harness.
    const finalFrame=frameFor(tabA),finalInput=finalFrame.contentDocument.querySelector('header input');
    Object.getOwnPropertyDescriptor(finalFrame.contentWindow.HTMLInputElement.prototype,'value').set.call(finalInput,'Native Quit Latest');
    finalInput.dispatchEvent(new finalFrame.contentWindow.Event('input',{bubbles:true}));
    await Zotero.Promise.delay(50);
    const finalId=tabs._tabs.find(t=>t.id===tabA).data.docId;
    expectedTabs.find(e=>e.docId===finalId).title='Native Quit Latest';
    await IOUtils.writeUTF8(restartStatePath,JSON.stringify({tabs:expectedTabs,workspaceIds:await workspaceIds(),papers:[a,b].map(p=>({key:p.key,libraryID:p.libraryID,count:host.getMindflowAttachments(p).length}))}));
  } catch(error) { results.push({name:'native startup',pass:false,error:String(error),stack:error.stack});await report(); }
  await Zotero.MindFlow?._closeSaveQueue;
  await Zotero.MindFlow?._archiveWriteQueue;
  await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir,'native-regression-done.txt'),'done');
  Services.startup.quit(Services.startup.eAttemptQuit);
})();
