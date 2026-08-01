// tt_hide_home.js
// Blocks the TikTok home feed (the "For You" video swiper) on the home page (/).
//
//   - Hides the video swiper (the whole feed) so no videos are shown.
//   - Paints the page black so the blocked area matches the other apps' blocks
//     (TikTok's web background is white, so hiding alone looks blank/white).
//   - Pauses any playing <video> so audio stops too.
//   - Locks scrolling and blocks swipe/wheel so the feed can't advance.
//   - Shows "Blocked by MobileLess". The top search and bottom nav keep their
//     own backgrounds, so they stay usable.
//   - Deactivates on any other path.

var _mlTtHomeLocked=window._mlTtHomeLocked||false;

function _mlTtHomePath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlTtIsHome(){
    var p=_mlTtHomePath();
    return p===''||p==='/'||p==='/foryou';
}

function _mlTtHomeBlockTouch(e){e.preventDefault();e.stopPropagation();}

function _mlTtHomeActivate(){
    if(!document.getElementById('ml-tt-home-style')){
        var s=document.createElement('style');
        s.id='ml-tt-home-style';
        s.textContent=[
            '[class*="DivSwiperContainer"]{visibility:hidden!important;}',
            '[data-e2e="video-card"]{visibility:hidden!important;}',
            '[data-e2e^="video-slide"]{visibility:hidden!important;}',
            // Black backdrop so the blocked area reads as a real block, not a
            // blank white page (TikTok web has a white body background).
            'html,body{overflow:hidden!important;background:#000!important;}',
        ].join('');
        (document.head||document.documentElement).appendChild(s);
    }

    document.querySelectorAll('video').forEach(function(v){ try{ v.pause(); }catch(e){} });

    if(!document.getElementById('ml-tt-home-overlay')){
        var o=document.createElement('div');
        o.id='ml-tt-home-overlay';
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

    if(!_mlTtHomeLocked){
        window.addEventListener('touchmove',_mlTtHomeBlockTouch,{capture:true,passive:false});
        window.addEventListener('wheel',_mlTtHomeBlockTouch,{capture:true,passive:false});
        _mlTtHomeLocked=true;
        window._mlTtHomeLocked=true;
    }
}

function _mlTtHomeDeactivate(){
    var s=document.getElementById('ml-tt-home-style');
    if(s&&s.parentNode)s.parentNode.removeChild(s);
    var o=document.getElementById('ml-tt-home-overlay');
    if(o&&o.parentNode)o.parentNode.removeChild(o);
    if(_mlTtHomeLocked){
        window.removeEventListener('touchmove',_mlTtHomeBlockTouch,{capture:true});
        window.removeEventListener('wheel',_mlTtHomeBlockTouch,{capture:true});
        _mlTtHomeLocked=false;
        window._mlTtHomeLocked=false;
    }
}

if(window._mlTtHomeInterval)clearInterval(window._mlTtHomeInterval);
window._mlTtHomeInterval=setInterval(function(){
    if(_mlTtIsHome()){ _mlTtHomeActivate(); }else{ _mlTtHomeDeactivate(); }
},600);
