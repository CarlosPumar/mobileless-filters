// yt_hide_home.js
// Only activates on the YouTube home page (/).
//
// Strategy:
//   - visibility:hidden on ytm-rich-grid-renderer hides the feed without
//     removing it from layout, so infinite-scroll never triggers.
//   - overflow:hidden on html+body prevents scrolling.
//   - A fixed overlay shows "Blocked by MobileLess".
//     The overlay uses z-index:3 (below the topbar's z-index:4) so the
//     search bar in ytm-mobile-topbar-renderer stays visible and tappable.
//   - Deactivates on any non-home path so search results, watch, etc. work.

var _mlYtHomeActive=window._mlYtHomeActive||false;

function _mlYtIsHome(){
    var p=window.location.pathname.replace(/\/+$/,'')||'/';
    return p==='/'||p==='';
}

function _mlYtHomeActivate(){
    if(!document.getElementById('ml-yt-home-style')){
        var s=document.createElement('style');
        s.id='ml-yt-home-style';
        s.textContent=[
            'ytm-rich-grid-renderer{visibility:hidden!important;}',
            'html,body{overflow:hidden!important;}',
        ].join('');
        (document.head||document.documentElement).appendChild(s);
    }

    if(!document.getElementById('ml-yt-home-overlay')){
        var o=document.createElement('div');
        o.id='ml-yt-home-overlay';
        o.setAttribute('style',[
            'position:fixed',
            'top:0',
            'left:0',
            'right:0',
            'bottom:0',
            'z-index:3',
            'display:flex',
            'align-items:center',
            'justify-content:center',
            'font-size:16px',
            'color:#888',
            'pointer-events:none',
            'text-align:center',
            'padding:16px',
            'box-sizing:border-box',
        ].join(';'));
        o.textContent='Blocked by MobileLess';
        document.body&&document.body.appendChild(o);
    }

    _mlYtHomeActive=true;
}

function _mlYtHomeDeactivate(){
    var s=document.getElementById('ml-yt-home-style');
    if(s&&s.parentNode)s.parentNode.removeChild(s);
    var o=document.getElementById('ml-yt-home-overlay');
    if(o&&o.parentNode)o.parentNode.removeChild(o);
    _mlYtHomeActive=false;
}

if(window._mlYtHomeInterval)clearInterval(window._mlYtHomeInterval);
window._mlYtHomeInterval=setInterval(function(){
    if(_mlYtIsHome()){
        _mlYtHomeActivate();
    }else{
        _mlYtHomeDeactivate();
    }
},600);
