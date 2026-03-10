(function(){
    function _mlHideAppBanners(){
        // 1. Hide full-screen fixed overlays that contain "Open in app" modals
        //    (e.g. "See full profile in the app", "See post in app")
        document.querySelectorAll('div').forEach(function(d){
            var cs=window.getComputedStyle(d);
            var zi=parseInt(cs.zIndex);
            if(isNaN(zi)||zi<=0||cs.position!=='fixed')return;
            var rect=d.getBoundingClientRect();
            if(rect.width<300||rect.height<300)return;
            var txt=d.textContent;
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
        // 4. Hide "Open/Abrir Instagram" button on the pre-login splash page.
        //    Uses class _aswr (primary filled button style, language-agnostic) with
        //    "instagram" text check to avoid false positives on other pages.
        var aswrBtn=document.querySelector('button._aswr');
        if(aswrBtn&&/instagram/i.test(aswrBtn.textContent)){
            var p=aswrBtn.parentElement;
            if(p) p.style.setProperty('display','none','important');
        }
        // Fallback: text-based check for known translations
        document.querySelectorAll('button').forEach(function(b){
            var t=b.textContent.trim();
            if(t==='Open Instagram'||t==='Abrir Instagram'||t==='Ouvrir Instagram'||t==='Instagram öffnen'){
                var p=b.parentElement;
                if(p) p.style.setProperty('display','none','important');
            }
        });
        // 5. Hide "Use the app" bottom banner (logged-in feed)
        document.querySelectorAll('button').forEach(function(b){
            if(b.textContent.trim()==='Use the app'){
                var el=b.parentElement;
                for(var i=0;i<6;i++){
                    if(!el||!el.parentElement)break;
                    var cs=window.getComputedStyle(el);
                    if(cs.position==='fixed'||cs.position==='sticky'||el.parentElement.tagName==='BODY'){
                        el.style.setProperty('display','none','important');
                        return;
                    }
                    el=el.parentElement;
                }
                if(b.parentElement) b.parentElement.style.setProperty('display','none','important');
            }
        });
        // 6. Hide "Get the full experience" signup bar at bottom (non-logged-in)
        document.querySelectorAll('div,section').forEach(function(d){
            if(d.children.length===0)return;
            var txt=d.textContent.trim();
            if(txt.indexOf('Get the full experience')===0||txt.indexOf('Sign up for Instagram to')===0){
                d.style.setProperty('display','none','important');
            }
        });
    }
    _mlHideAppBanners();
    if(window._mlBaselineInterval)clearInterval(window._mlBaselineInterval);
    window._mlBaselineInterval=setInterval(_mlHideAppBanners,2000);
})();
