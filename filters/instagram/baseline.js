(function(){
    function _mlHideAppBanners(){
        // 1. Hide full-screen fixed overlays that contain "Open in app" modals
        //    (e.g. "See full profile in the app", "See post in app").
        //    Text-length guard: a genuine "Open in app" overlay has short text
        //    (< 400 chars). Instagram's main app container is also position:fixed
        //    and spans the full viewport, but its textContent runs into thousands
        //    of characters — checking length avoids hiding the whole page.
        document.querySelectorAll('div').forEach(function(d){
            var cs=window.getComputedStyle(d);
            var zi=parseInt(cs.zIndex);
            if(isNaN(zi)||zi<=0||cs.position!=='fixed')return;
            var rect=d.getBoundingClientRect();
            if(rect.width<300||rect.height<300)return;
            var txt=d.textContent;
            if(txt.length>400)return; // skip large containers (main app shell)
            if(txt.indexOf('Open Instagram')>=0||txt.indexOf('Abrir Instagram')>=0||txt.indexOf('Open app')>=0||txt.indexOf('Abrir la aplicación')>=0||txt.indexOf('See full profile')>=0||txt.indexOf('Ver perfil completo')>=0||txt.indexOf('See post in the app')>=0){
                d.style.setProperty('display','none','important');
            }
        });
        // 2. Hide intent:// links (Open app pill in top nav + Open Instagram in dialog)
        document.querySelectorAll('a[href^="intent://"]').forEach(function(a){
            var p=a.parentElement;
            if(p) p.style.setProperty('display','none','important');
        });
        // 3. Also hide the Close (x) dismiss button sibling of the Open app pill in _ab18
        var ab18=document.querySelector('._ab18');
        if(ab18){
            Array.prototype.forEach.call(ab18.querySelectorAll('div'),function(child){
                if(child.textContent.trim()==='Close'){
                    child.style.setProperty('display','none','important');
                }
            });
        }
        // 4. Hide "Open Instagram" / "Abrir Instagram" CTA buttons using exact
        //    text matching only. Only hides the parent wrapper when it is a small
        //    container (txtLen <= button text + ~5 chars overhead) that contains
        //    nothing else important. If the parent is a larger element (e.g. a <nav>
        //    that also contains "Log in"), only the button itself is hidden to avoid
        //    accidentally blocking login/signup actions.
        var _openIgTexts=['Open Instagram','Abrir Instagram','Ouvrir Instagram','Instagram öffnen','Open in Instagram'];
        document.querySelectorAll('button').forEach(function(b){
            var t=b.textContent.trim();
            for(var i=0;i<_openIgTexts.length;i++){
                if(t===_openIgTexts[i]){
                    var p=b.parentElement;
                    if(p&&p.textContent.length<=t.length+5){
                        p.style.setProperty('display','none','important');
                    } else {
                        b.style.setProperty('display','none','important');
                    }
                    break;
                }
            }
        });
        // 5. "Use the app" / "Usar la aplicación" bottom banner (logged-in feed):
        //    hide it (instant, no flash) AND click its Close so Instagram records
        //    the dismissal and it stops reappearing across sessions. The Close is
        //    scoped to the banner (smallest ancestor holding both the text and a
        //    Close icon), so we never click a Close of a story/modal/post.
        var _mlUseAppRE=/^(use the app|usar la aplicaci[oó]n|use la app|usar a app|open the app|abrir la aplicaci[oó]n|utiliser l|app öffnen)/i;
        var _mlBanner=null;
        document.querySelectorAll('button,div[role="button"],a').forEach(function(el){
            if(_mlBanner)return;
            var t=(el.textContent||'').trim();
            if(t.length<=40&&_mlUseAppRE.test(t))_mlBanner=el;
        });
        if(_mlBanner){
            // Smallest ancestor that also contains a Close icon = the banner bar.
            var _bar=null,_n=_mlBanner;
            for(var _k=0;_k<8&&_n;_k++){
                if(_n.querySelector&&_n.querySelector('svg[aria-label="Close"],svg[aria-label="Cerrar"]')){_bar=_n;break;}
                _n=_n.parentElement;
            }
            if(_bar&&_bar.getAttribute('data-ml-banner-dismissed')!=='1'){
                _bar.setAttribute('data-ml-banner-dismissed','1');
                var _svg=_bar.querySelector('svg[aria-label="Close"],svg[aria-label="Cerrar"]');
                var _close=_svg&&(_svg.closest('[role="button"],button')||_svg.parentElement);
                if(_close){
                    try{if(_close.click)_close.click();}catch(e){}
                    try{_close.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));}catch(e){}
                }
            }
            // Safety net: hide the banner's fixed/sticky container so it never
            // flashes, even if the Close click didn't take.
            var _c=_mlBanner,_h=0;
            while(_c&&_h<8){
                var _cs=window.getComputedStyle(_c);
                if(_cs.position==='fixed'||_cs.position==='sticky'){_c.style.setProperty('display','none','important');break;}
                if(!_c.parentElement||_c.parentElement.tagName==='BODY')break;
                _c=_c.parentElement;_h++;
            }
        }
    }
    _mlHideAppBanners();
    if(window._mlBaselineInterval)clearInterval(window._mlBaselineInterval);
    window._mlBaselineInterval=setInterval(_mlHideAppBanners,2000);
})();
