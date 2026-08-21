// yt_hide_subscriptions.js
// Blocks the Subscriptions tab entirely. Two behaviours:
//
//   1. Always: hide the Subscriptions item in the bottom navigation
//      (ytm-pivot-bar-item-renderer) so the tab can't be tapped. Matched by its
//      class token OR its localized label (see _mlYtPivotIsSubs).
//
//   2. On /feed/subscriptions: block the feed the same way yt_hide_home blocks
//      the home feed —
//        - visibility:hidden on ytm-browse hides the feed without removing it
//          from layout, so infinite-scroll never triggers. The topbar and the
//          bottom nav live outside ytm-browse, so they stay visible.
//        - overflow:hidden on html+body prevents scrolling.
//        - A fixed overlay shows "Blocked by MobileLess" at z-index:3 (below
//          the topbar's z-index:4) so the search bar stays tappable.
//      Deactivates on any other path.

var _mlYtSubsActive=window._mlYtSubsActive||false;

function _mlYtSubsPath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlYtIsSubsFeed(){
    return _mlYtSubsPath().indexOf('/feed/subscriptions')===0;
}

// ── 1. Always hide the Subscriptions tab ───────────────────────────────────

// Roots of the word "Subscriptions" across YouTube's UI languages. Used as a
// class-independent fallback: YouTube renames pivot classes (home is
// .pivot-w2w, not .pivot-home), so we can't rely on .pivot-subscriptions alone.
var _ML_YT_SUBS_ROOTS=['subscri','suscrip','abonn','inscri','iscrizion','подписк','abos','prenumer','구독','登録','訂閱','订阅','abonnement','abonnee'];

function _mlYtPivotIsSubs(item){
    // (a) Internal class token (not localized): the tab is .pivot-subs
    //     (confirmed on device — NOT .pivot-subscriptions).
    if(item.querySelector('[class*="pivot-subs"]'))return true;
    // (b) Localized label fallback — works even when the class was renamed.
    var label=(item.getAttribute('aria-label')||'')+' '+(item.textContent||'');
    var innerAria=item.querySelector('[aria-label]');
    if(innerAria)label+=' '+(innerAria.getAttribute('aria-label')||'');
    label=label.toLowerCase();
    for(var i=0;i<_ML_YT_SUBS_ROOTS.length;i++){
        if(label.indexOf(_ML_YT_SUBS_ROOTS[i])!==-1)return true;
    }
    return false;
}

function _mlYtHideSubsTab(){
    document.querySelectorAll('ytm-pivot-bar-item-renderer').forEach(function(item){
        if(item.getAttribute('data-ml-subs-hidden')==='1')return;
        if(_mlYtPivotIsSubs(item)){
            item.style.setProperty('display','none','important');
            item.setAttribute('data-ml-subs-hidden','1');
        }
    });
}

// ── 2. Block the Subscriptions feed ────────────────────────────────────────

function _mlYtSubsActivate(){
    if(!document.getElementById('ml-yt-subs-style')){
        var s=document.createElement('style');
        s.id='ml-yt-subs-style';
        s.textContent=[
            'ytm-browse{visibility:hidden!important;}',
            'html,body{overflow:hidden!important;}',
        ].join('');
        (document.head||document.documentElement).appendChild(s);
    }

    if(!document.getElementById('ml-yt-subs-overlay')){
        var o=document.createElement('div');
        o.id='ml-yt-subs-overlay';
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
            'font-family:-apple-system,BlinkMacSystemFont,system-ui,Roboto,Helvetica,Arial,sans-serif',
            'font-size:16px',
            'font-weight:400',
            'color:#888',
            'pointer-events:none',
            'text-align:center',
            'padding:16px',
            'box-sizing:border-box',
        ].join(';'));
        o.textContent='Blocked by MobileLess';
        document.body&&document.body.appendChild(o);
    }

    _mlYtSubsActive=true;
    window._mlYtSubsActive=true;
}

function _mlYtSubsDeactivate(){
    var s=document.getElementById('ml-yt-subs-style');
    if(s&&s.parentNode)s.parentNode.removeChild(s);
    var o=document.getElementById('ml-yt-subs-overlay');
    if(o&&o.parentNode)o.parentNode.removeChild(o);
    _mlYtSubsActive=false;
    window._mlYtSubsActive=false;
}

// ── Main interval ──────────────────────────────────────────────────────────

if(window._mlYtSubsInterval)clearInterval(window._mlYtSubsInterval);
window._mlYtSubsInterval=setInterval(function(){
    _mlYtHideSubsTab();

    if(_mlYtIsSubsFeed()){
        _mlYtSubsActivate();
    }else{
        _mlYtSubsDeactivate();
    }
},600);
