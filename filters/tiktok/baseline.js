(function(){
    // Always-on: hide TikTok's "Open app" / "Open TikTok" banners and CTA
    // buttons that nag the user to leave the web for the native app.
    function _mlTtHideAppBanners(){
        var texts=['Open app','Open TikTok','Abrir app','Abrir TikTok','Abrir la aplicación','Get app','Get the app'];
        document.querySelectorAll('button,a').forEach(function(b){
            var t=(b.textContent||'').trim();
            if(t.length>24)return;
            for(var i=0;i<texts.length;i++){
                if(t===texts[i]){
                    // Hide the small wrapper if it's only the button; otherwise
                    // just the button (avoid nuking a large container).
                    var p=b.parentElement;
                    if(p&&(p.textContent||'').trim().length<=t.length+5){
                        p.style.setProperty('display','none','important');
                    }else{
                        b.style.setProperty('display','none','important');
                    }
                    break;
                }
            }
        });
    }
    _mlTtHideAppBanners();
    if(window._mlTtBaselineInterval)clearInterval(window._mlTtBaselineInterval);
    window._mlTtBaselineInterval=setInterval(_mlTtHideAppBanners,2000);
})();
