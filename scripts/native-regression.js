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
      const getIcon=node=>node?.querySelector('.toolbarbutton-icon') || node?.shadowRoot?.querySelector('.toolbarbutton-icon');
      const icon=getIcon(button);
      const reference=getIcon(win.document.getElementById('zotero-tb-note-add') || win.document.getElementById('zotero-tb-note'));
      check(icon && reference,'Native toolbar icons are unavailable');
      const selected=tabs.selectedID;
      try {
        tabs.select('zotero-pane');
        await waitFor(()=>reference.getBoundingClientRect().width>0,'visible native toolbar');
        const actual=icon.getBoundingClientRect(),native=reference.getBoundingClientRect();
        await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir,'toolbar-icon-metrics.json'),JSON.stringify({
          mindflow:{width:actual.width,height:actual.height},native:{width:native.width,height:native.height},
          image:button.getAttribute('image'),label:button.getAttribute('label'),ariaLabel:button.getAttribute('aria-label')},null,2));
        check(Math.abs(actual.width-native.width)<0.1 && Math.abs(actual.height-native.height)<0.1,'MindFlow icon size differs from adjacent native icon');
        const canvas=win.document.createElementNS('http://www.w3.org/1999/xhtml','canvas');
        const buttonBounds=button.getBoundingClientRect();
        canvas.width=win.innerWidth;canvas.height=Math.ceil(buttonBounds.height+16);
        canvas.getContext('2d').drawWindow(win,0,Math.max(0,buttonBounds.top-8),canvas.width,canvas.height,'rgb(255,255,255)');
        const binary=win.atob(canvas.toDataURL('image/png').split(',')[1]);
        await IOUtils.write(PathUtils.join(Zotero.DataDirectory.dir,'toolbar-icon-preview.png'),Uint8Array.from(binary,c=>c.charCodeAt(0)));
      } finally { tabs.select(selected); }
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
    await run('item-pane sidenav keeps the MindFlow entry icon-only', async () => {
      tabs.select('zotero-pane');
      await win.ZoteroPane.collectionsView.selectLibrary(a.libraryID);
      const itemsView = await waitFor(() => win.ZoteroPane.itemsView, 'library item view initialized');
      const libraryRow = win.ZoteroPane.collectionsView.getRow(win.ZoteroPane.collectionsView.getRowIndexByID('L' + a.libraryID));
      check(libraryRow, 'library row missing');
      await itemsView.changeCollectionTreeRows([libraryRow]);
      await itemsView.waitForLoad();
      await itemsView.selectItems([a.id]);
      const custom = await waitFor(
        () => [...win.document.querySelectorAll('item-pane-sidenav')].map(nav => nav.querySelector('.btn[data-pane*="mindflow"]')).find(Boolean),
        'MindFlow item-pane sidenav button'
      );
      await win.document.l10n.translateElements([custom]);
      check(!custom.textContent.trim(), 'sidenav button contains visible text');
      check(!custom.getAttribute('label'), 'sidenav button exposes a visual label');
      check(['MindFlow 导图', 'MindFlow Maps'].includes(custom.getAttribute('tooltiptext')),
        'sidenav tooltip localization is missing or incorrect: ' + custom.getAttribute('tooltiptext'));
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
    // Additional editor regressions use their own workspace and close it before
    // the original session-restart matrix. They run against the packaged code.
    let auditTab;
    const auditDoc = await host.workspaceStorage('commitDocument', { expectedRevision: 0, doc: {
      ...map('Logic Audit'), id: 'logic_audit', revision: 0,
      root: { id: 'audit_root', text: 'Logic Audit Root', children: [
        { id: 'audit_connected', text: 'Audit Connected', children: [{ id: 'audit_hidden', text: 'Audit Hidden', children: [] }] },
        { id: 'audit_survivor', text: 'Audit Survivor', children: [] } ] },
      relationships: [{ id: 'audit_rel', fromId: 'audit_root', toId: 'audit_hidden', label: 'Evidence' }],
    } });
    host.openMindFlow({ mode: 'open_document', doc: auditDoc, workspaceDocumentId: auditDoc.id, forceNew: true }, win);
    auditTab = tabs.selectedID;
    await waitFor(() => titleFor(auditTab) === 'Logic Audit', 'editor audit workspace');
    const auditFrame = () => frameFor(auditTab);
    const auditState = async () => auditFrame().contentWindow.wrappedJSObject._mindflowCaptureState?.()?.doc ||
      JSON.parse(await host.workspaceStorage('get', { key: `mindflow_doc_${tabs._tabs.find(t => t.id === auditTab).data.docId}` }));
    const auditClick = text => {
      const document = auditFrame().contentDocument;
      document.activeElement?.blur?.();
      const node = document.querySelector(`span[title="${text}"]`); check(node, 'audit node missing: ' + text); node.click();
    };
    const auditKey = (key, options = {}) => {
      const frame = auditFrame(); frame.contentDocument.activeElement?.blur?.();
      frame.contentDocument.body.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key, bubbles: true, ...options }));
    };
    const auditButton = title => { const button = auditFrame().contentDocument.querySelector(`button[title="${title}"]`); check(button, 'audit button missing: ' + title); button.click(); };
    await run('editor deleting a connected branch prunes all descendant links and saves to disk', async () => {
      auditClick('Audit Connected'); await Zotero.Promise.delay(80); auditKey('Delete');
      await Zotero.Promise.delay(900);
      const saved = JSON.parse(await host.workspaceStorage('get', { key: 'mindflow_doc_logic_audit' }));
      check(saved.root.children.length === 1 && saved.relationships.length === 0, 'deleted branch or dangling relationship was not saved');
    });
    await run('editor undo restores deleted descendants and their relationship together', async () => {
      auditButton('撤销 (Ctrl+Z)'); await Zotero.Promise.delay(100);
      const state = await auditState(); check(state.root.children.length === 2 && state.relationships.length === 1, 'undo lost subtree or relationship');
    });
    await run('editor redo deletes the branch and relationship together', async () => {
      auditButton('重做 (Ctrl+Y)'); await Zotero.Promise.delay(100);
      const state = await auditState(); check(state.root.children.length === 1 && state.relationships.length === 0, 'redo left stale relationship');
    });
    await run('editor relation creation, deletion and undo use the same history as nodes', async () => {
      auditClick('Audit Survivor'); await Zotero.Promise.delay(80); auditButton('建立跨分支关联线'); await Zotero.Promise.delay(80);
      auditClick('Logic Audit Root'); await Zotero.Promise.delay(80);
      check((await auditState()).relationships.length === 1, 'relationship creation failed');
      auditButton('撤销 (Ctrl+Z)'); await Zotero.Promise.delay(80);
      check((await auditState()).relationships.length === 0 && (await auditState()).root.children.length === 1, 'relation undo changed unrelated tree');
      auditButton('重做 (Ctrl+Y)'); await Zotero.Promise.delay(80);
      auditButton('删除此关联线'); await Zotero.Promise.delay(80);
      check((await auditState()).relationships.length === 0, 'relationship deletion failed');
      auditButton('撤销 (Ctrl+Z)'); await Zotero.Promise.delay(80);
      check((await auditState()).relationships.length === 1, 'deleted relationship cannot be restored');
    });
    await run('editor undo of insertion leaves a valid selection for the next Tab insertion', async () => {
      auditClick('Logic Audit Root'); await Zotero.Promise.delay(80); auditButton('插入子主题 (Tab)'); await Zotero.Promise.delay(80);
      auditKey('Escape'); await Zotero.Promise.delay(80); auditButton('撤销 (Ctrl+Z)'); await Zotero.Promise.delay(80);
      auditKey('Tab'); await Zotero.Promise.delay(80);
      check((await auditState()).root.children.length === 2, 'Tab used an undone nonexistent node as parent');
      auditKey('Escape'); await Zotero.Promise.delay(80);
    });
    await run('editor shortcuts modal cannot edit underlying nodes with Tab or Delete', async () => {
      auditClick('Audit Survivor'); await Zotero.Promise.delay(80);
      const before = JSON.stringify((await auditState()).root);
      auditButton('快捷键大全 (?)'); await Zotero.Promise.delay(80); auditKey('Tab'); auditKey('Delete'); await Zotero.Promise.delay(80);
      check(JSON.stringify((await auditState()).root) === before, 'modal keyboard edited background map');
      const label = [...auditFrame().contentDocument.querySelectorAll('span')].find(n => n.textContent === '全键盘操作指南与快捷键');
      check(label, 'shortcuts modal missing'); label.parentElement.parentElement.querySelector('button').click();
    });
    await run('editor outline Enter during Chinese composition does not commit text', async () => {
      auditButton('结构大纲 (Outline)'); await Zotero.Promise.delay(80);
      const frame = auditFrame(), document = frame.contentDocument;
      const label = await waitFor(() => [...document.querySelectorAll('span[title="双击可编辑文本"]')].find(n => n.textContent === 'Logic Audit Root'), 'outline root ready');
      label.dispatchEvent(new frame.contentWindow.MouseEvent('dblclick', { bubbles: true }));
      const input = await waitFor(() => document.querySelector('input[data-mindflow-node-draft="audit_root"]'), 'outline input');
      input.dispatchEvent(new frame.contentWindow.KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }));
      await Zotero.Promise.delay(80); check(document.querySelector('input[data-mindflow-node-draft="audit_root"]'), 'composition Enter prematurely committed');
    });
    await run('editor document switch saves uncommitted outline text before changing maps', async () => {
      const other = await host.workspaceStorage('commitDocument', { expectedRevision: 0, doc: { ...map('Audit Other Document'), id: 'audit_other', revision: 0,
        root: { id: 'other_root', text: 'Audit Other Root', children: [{ id: 'other_child', text: 'Audit Other Child', children: [] }] } } });
      const frame = auditFrame(), document = frame.contentDocument;
      let input = document.querySelector('input[data-mindflow-node-draft="audit_root"]');
      if (!input) {
        const label = [...document.querySelectorAll('span[title="双击可编辑文本"]')].find(n => n.textContent === 'Logic Audit Root');
        check(label, 'outline root missing for switch'); label.dispatchEvent(new frame.contentWindow.MouseEvent('dblclick', { bubbles: true }));
        input = await waitFor(() => document.querySelector('input[data-mindflow-node-draft="audit_root"]'), 'switch outline input');
      }
      Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype, 'value').set.call(input, 'Audit Pending Switch');
      input.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true })); await Zotero.Promise.delay(50);
      auditButton('文档库 (Documents)');
      const row = await waitFor(() => [...document.querySelectorAll('span')].find(n => n.textContent === other.title)?.closest('div.group'), 'switch target row');
      row.click(); await waitFor(() => titleFor(auditTab) === other.title, 'switch completed');
      const saved = JSON.parse(await host.workspaceStorage('get', { key: 'mindflow_doc_logic_audit' }));
      check(saved.root.text === 'Audit Pending Switch', 'switch lost uncommitted node draft');
    });
    await run('editor Ctrl deselection of last selected node prevents accidental deletion', async () => {
      auditClick('Audit Other Child'); await Zotero.Promise.delay(80);
      const frame = auditFrame(), label = frame.contentDocument.querySelector('span[title="Audit Other Child"]');
      label.dispatchEvent(new frame.contentWindow.MouseEvent('click', { bubbles: true, ctrlKey: true })); await Zotero.Promise.delay(80);
      auditKey('Delete'); await Zotero.Promise.delay(80);
      check((await auditState()).root.children.length === 1, 'deselected node was still deleted');
    });
    await run('native concurrent inbox operations preserve entries in a verified durable file', async () => {
      const item = id => ({ id, text: id, createdAt: Date.now(), isProcessed: false });
      await Promise.all(['native_inbox_a', 'native_inbox_b'].map(id => host.workspaceStorage('mutateInbox', { additions: [item(id)] })));
      const path = PathUtils.join(Zotero.DataDirectory.dir, 'mindflow', 'workspace', 'mindflow_inbox_items.json');
      const items = JSON.parse(await IOUtils.readUTF8(path)); check(items.length === 2, 'concurrent inbox addition lost a record');
    });
    await run('inbox insertion is marked processed only after map save and retry adds no duplicate', async () => {
      auditButton('灵感与收集箱 (Inbox)');
      const document = auditFrame().contentDocument;
      const insert = await waitFor(() => [...document.querySelectorAll('p')].find(n => n.textContent === 'native_inbox_a')?.parentElement.querySelector('button'), 'inbox insertion control');
      const currentId = tabs._tabs.find(t => t.id === auditTab).data.docId;
      const before = (await auditState()).root.children.length;
      const original = host.workspaceStorage;
      host.workspaceStorage = async function(action, payload) {
        if (action === 'commitDocument' && payload?.doc?.id === currentId) throw new Error('injected inbox save failure');
        return original.call(this, action, payload);
      };
      try {
        insert.click(); await Zotero.Promise.delay(180);
        const inbox = JSON.parse(await original.call(host, 'get', { key: 'mindflow_inbox_items' }));
        check(!inbox.find(item => item.id === 'native_inbox_a').isProcessed, 'failed map save marked inbox processed');
        check((await auditState()).root.children.length === before + 1, 'insertion draft was discarded');
      } finally { host.workspaceStorage = original; }
      insert.click();
      await waitFor(async () => JSON.parse(await original.call(host, 'get', { key: 'mindflow_inbox_items' })).find(item => item.id === 'native_inbox_a').isProcessed, 'successful inbox insertion persisted');
      const saved = JSON.parse(await original.call(host, 'get', { key: `mindflow_doc_${currentId}` }));
      check(saved.root.children.length === before + 1, 'save retry duplicated the inserted branch');
    });
    await run('native restoreDeleted checks revisions and can deliberately revive a deleted map', async () => {
      const doc = { ...map('Restore Guard'), id: 'native_restore_guard', revision: 0 };
      const saved = await host.workspaceStorage('commitDocument', { doc, expectedRevision: 0 });
      let conflict = false;
      try { await host.workspaceStorage('commitDocument', { doc: { ...doc, title: 'stale' }, expectedRevision: 0, restoreDeleted: true }); }
      catch (error) { conflict = String(error).includes('REVISION_CONFLICT'); }
      check(conflict, 'restore bypassed compare-and-save');
      await host.workspaceStorage('deleteDocument', { id: doc.id, expectedRevision: saved.revision });
      await host.workspaceStorage('commitDocument', { doc, expectedRevision: 0, restoreDeleted: true });
      check(!(await host.workspaceStorage('get', { key: 'mindflow_deleted_doc_' + doc.id })), 'restore left tombstone');
    });
    await run('native corrupt snapshot mutation fails without changing the stored file', async () => {
      const key = 'mindflow_snapshots_native_bad_snapshots';
      await host.workspaceStorage('setMany', { items: { [key]: '[null]' } });
      let rejected = false;
      try { await host.workspaceStorage('mutateSnapshots', { docId: 'native_bad_snapshots', snapshots: [] }); }
      catch (_) { rejected = true; }
      check(rejected && await host.workspaceStorage('get', { key }) === '[null]', 'corrupt snapshot was rewritten');
      await host.workspaceStorage('remove', { key });
    });
    await run('editor snapshot restore locks input, restores content and refreshes recovery history', async () => {
      const current = await auditState();
      const key = 'mindflow_snapshots_' + current.id;
      const old = { ...current, title: 'Native Snapshot Restored' };
      await host.workspaceStorage('mutateSnapshots', { docId: current.id, snapshots: [{ id: 'native_restore_ui', docId: current.id,
        title: old.title, timestamp: Date.now() + 5000, nodeCount: 1, data: JSON.stringify(old) }] });
      auditButton('数据安全与备份 (Security & Snapshots)');
      const frame = auditFrame(), document = frame.contentDocument;
      const button = await waitFor(() => document.querySelector('button[title="还原此快照"]'), 'snapshot restore button');
      const editor = frame.contentWindow.wrappedJSObject;
      const originalConfirm = editor.confirm, originalStorage = host.workspaceStorage;
      Components.utils.exportFunction(() => true, editor, { defineAs: 'confirm' });
      const promptObserver = { observe(dialogWindow, topic) {
        if (topic !== 'domwindowopened') return;
        dialogWindow.addEventListener('load', () => {
          if (!dialogWindow.document.documentURI.includes('commonDialog')) return;
          dialogWindow.document.querySelector('dialog')?.acceptDialog();
        }, { once: true });
      } };
      Services.ww.registerNotification(promptObserver);
      host.workspaceStorage = async function(action, payload) {
        if (action === 'commitDocument' && payload?.doc?.title === old.title) await Zotero.Promise.delay(400);
        return originalStorage.call(this, action, payload);
      };
      try {
        await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir, 'restore-ui-phase.txt'), 'before click');
        button.click();
        await IOUtils.writeUTF8(PathUtils.join(Zotero.DataDirectory.dir, 'restore-ui-phase.txt'), 'after click');
        await waitFor(() => [...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('正在恢复快照')), 'restore input lock');
        const before = (await auditState()).root.children.length;
        auditKey('Tab'); await Zotero.Promise.delay(60);
        check((await auditState()).root.children.length === before, 'restore allowed keyboard tree mutation');
        await waitFor(() => titleFor(auditTab) === old.title, 'restored title');
        await waitFor(() => document.querySelectorAll('button[title="还原此快照"]').length >= 2, 'recovery history refresh');
        check(![...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('正在恢复快照')), 'restore overlay remained stuck');
      } finally { Services.ww.unregisterNotification(promptObserver); editor.confirm = originalConfirm; host.workspaceStorage = originalStorage; }
    });
    await run('editor JSON export captures uncommitted node drafts before generating the file', async () => {
      const frame = auditFrame(), document = frame.contentDocument, editor = frame.contentWindow.wrappedJSObject;
      const current = await auditState();
      const label = document.querySelector(`span[title="${current.root.text}"]`);
      check(label, 'export root label missing');
      label.dispatchEvent(new frame.contentWindow.MouseEvent('dblclick', { bubbles: true }));
      const input = await waitFor(() => document.querySelector('input[data-mindflow-node-draft]'), 'export node draft');
      Object.getOwnPropertyDescriptor(frame.contentWindow.HTMLInputElement.prototype, 'value').set.call(input, 'Native Export Pending Draft');
      input.dispatchEvent(new frame.contentWindow.Event('input', { bubbles: true }));
      let exportedBlob;
      const originalURL = editor.URL.createObjectURL, originalClick = editor.HTMLAnchorElement.prototype.click;
      Components.utils.exportFunction(blob => { exportedBlob = blob; return 'blob:mindflow-native-export-test'; }, editor.URL, { defineAs: 'createObjectURL' });
      Components.utils.exportFunction(() => {}, editor.HTMLAnchorElement.prototype, { defineAs: 'click' });
      try {
        document.querySelector('button[title="导入与导出"]').click();
        const button = await waitFor(() => [...document.querySelectorAll('button')].find(node => node.textContent.includes('JSON 工程备份')), 'JSON export action');
        button.click();
        await waitFor(() => exportedBlob, 'generated JSON blob');
        const parsed = JSON.parse(await exportedBlob.text());
        check(parsed.root.text === 'Native Export Pending Draft', 'export discarded uncommitted draft');
        const saved = JSON.parse(await host.workspaceStorage('get', { key: 'mindflow_doc_' + parsed.id }));
        check(saved.root.text === parsed.root.text, 'export did not persist captured draft');
      } finally { editor.URL.createObjectURL = originalURL; editor.HTMLAnchorElement.prototype.click = originalClick; }
    });
    await run('workspace restore locks the editor and reloads canonical restored content', async () => {
      const frame = auditFrame(), document = frame.contentDocument, editor = frame.contentWindow.wrappedJSObject;
      const current = await auditState(), restored = { ...current, title: 'Native Workspace Restored' };
      const backup = JSON.stringify({ documents: [restored], inboxItems: [], snapshots: [] });
      auditButton('数据安全与备份 (Security & Snapshots)');
      const input = await waitFor(() => document.querySelector('input[type="file"][accept=".json"]'), 'workspace import input');
      const files = new frame.contentWindow.DataTransfer();
      files.items.add(new frame.contentWindow.File([backup], 'native-backup.json', { type: 'application/json' }));
      input.files = files.files;
      const originalConfirm = editor.confirm, originalStorage = host.workspaceStorage;
      Components.utils.exportFunction(() => true, editor, { defineAs: 'confirm' });
      host.workspaceStorage = async function(action, payload) {
        if (action === 'commitDocument' && payload?.doc?.title === restored.title) await Zotero.Promise.delay(400);
        return originalStorage.call(this, action, payload);
      };
      try {
        input.dispatchEvent(new frame.contentWindow.Event('change', { bubbles: true }));
        await waitFor(() => [...document.querySelectorAll('[role="status"]')].some(node => node.textContent.includes('正在恢复工作区')), 'workspace restore lock');
        const before = (await auditState()).root.children.length;
        auditKey('Tab'); await Zotero.Promise.delay(60);
        check((await auditState()).root.children.length === before, 'workspace restore accepted tree edits');
        await waitFor(() => titleFor(auditTab) === restored.title, 'canonical restored title');
        await Zotero.Promise.delay(800);
        const saved = JSON.parse(await originalStorage.call(host, 'get', { key: 'mindflow_doc_' + restored.id }));
        check(saved.title === restored.title, 'old editor state overwrote restored document');
      } finally { editor.confirm = originalConfirm; host.workspaceStorage = originalStorage; }
    });
    tabs.close(auditTab); await host._closeSaveQueue;
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
