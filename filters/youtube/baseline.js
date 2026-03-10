(function(){
    function _mlYtHideAppBanners(){
        // Hide the "Open App" intent:// button in the topbar (shown when not logged in).
        // The link lives inside ytm-button-renderer.icon-avatar_logged_out inside
        // div.mobile-topbar-header-sign-in-button.
        document.querySelectorAll('a[href^="intent://"]').forEach(function(a){
            var p=a.closest('ytm-button-renderer')||a.parentElement;
            if(p) p.style.setProperty('display','none','important');
        });
    }
    _mlYtHideAppBanners();
    if(window._mlYtBaselineInterval)clearInterval(window._mlYtBaselineInterval);
    window._mlYtBaselineInterval=setInterval(_mlYtHideAppBanners,2000);
})();
