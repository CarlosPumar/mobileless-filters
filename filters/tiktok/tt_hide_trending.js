// tt_hide_trending.js
// Blocks the TikTok "Discover" / trending page (/discover) — a grid of trending
// videos and hashtags. Same treatment as the home block: hide the content, paint
// it black, pause videos, lock scroll, overlay. The bottom nav stays usable.

var _mlTtTrendLocked=window._mlTtTrendLocked||false;

function _mlTtTrendPath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlTtIsTrending(){
    return _mlTtTrendPath().indexOf('/discover')===0;
}

function _mlTtTrendBlockTouch(e){e.preventDefault();e.stopPropagation();}

function _mlTtTrendActivate(){
    if(!document.getElementById('ml-tt-trend-style')){
        var s=document.createElement('style');
        s.id='ml-tt-trend-style';
        s.textContent=[
            '[class*="DivNewDiscoverContainer"]{visibility:hidden!important;}',
            '[class*="DivVideoListContainer"]{visibility:hidden!important;}',
            '[data-e2e="video-item"]{visibility:hidden!important;}',
            'html,body{overflow:hidden!important;background:#000!important;}',
        ].join('');
        (document.head||document.documentElement).appendChild(s);
    }

    document.querySelectorAll('video').forEach(function(v){ try{ v.pause(); }catch(e){} });

    if(!document.getElementById('ml-tt-trend-overlay')){
        var o=document.createElement('div');
        o.id='ml-tt-trend-overlay';
        o.setAttribute('style',[
            'position:fixed','top:0','left:0','right:0','bottom:0','z-index:1',
            'display:flex','align-items:center','justify-content:center',
            'font-family:-apple-system,BlinkMacSystemFont,system-ui,Roboto,Helvetica,Arial,sans-serif',
            'font-size:16px','font-weight:400','color:#888',
            'pointer-events:none','text-align:center','padding:16px','box-sizing:border-box',
        ].join(';'));
        o.textContent='Blocked by MobileLess';
        document.body&&document.body.appendChild(o);
    }

    if(!_mlTtTrendLocked){
        window.addEventListener('touchmove',_mlTtTrendBlockTouch,{capture:true,passive:false});
        window.addEventListener('wheel',_mlTtTrendBlockTouch,{capture:true,passive:false});
        _mlTtTrendLocked=true;
        window._mlTtTrendLocked=true;
    }
}

function _mlTtTrendDeactivate(){
    var s=document.getElementById('ml-tt-trend-style');
    if(s&&s.parentNode)s.parentNode.removeChild(s);
    var o=document.getElementById('ml-tt-trend-overlay');
    if(o&&o.parentNode)o.parentNode.removeChild(o);
    if(_mlTtTrendLocked){
        window.removeEventListener('touchmove',_mlTtTrendBlockTouch,{capture:true});
        window.removeEventListener('wheel',_mlTtTrendBlockTouch,{capture:true});
        _mlTtTrendLocked=false;
        window._mlTtTrendLocked=false;
    }
}

if(window._mlTtTrendInterval)clearInterval(window._mlTtTrendInterval);
window._mlTtTrendInterval=setInterval(function(){
    if(_mlTtIsTrending()){ _mlTtTrendActivate(); }else{ _mlTtTrendDeactivate(); }
},600);
