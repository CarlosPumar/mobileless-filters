// tt_hide_foryou.js
// Blocks the TikTok "For You" video feed on the home page (/).
//
//   - Hides the video swiper (the whole feed) so no videos are shown.
//   - Pauses any playing <video> so audio stops too (hiding alone doesn't).
//   - Locks scrolling and blocks swipe/wheel so the feed can't advance.
//   - Shows "Blocked by MobileLess". The bottom nav is a separate fixed element,
//     so search / profile stay reachable.
//   - Deactivates on any other path (search, profile, a specific video, …).

var _mlTtScrollLocked=window._mlTtScrollLocked||false;

function _mlTtPath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlTtIsForYou(){
    var p=_mlTtPath();
    return p===''||p==='/'||p==='/foryou';
}

function _mlTtBlockTouch(e){e.preventDefault();e.stopPropagation();}

function _mlTtActivate(){
    if(!document.getElementById('ml-tt-style')){
        var s=document.createElement('style');
        s.id='ml-tt-style';
        s.textContent=[
            // The feed is a full-screen swiper. Hide it and its video slides.
            '[class*="DivSwiperContainer"]{visibility:hidden!important;}',
            '[data-e2e="video-card"]{visibility:hidden!important;}',
            '[data-e2e^="video-slide"]{visibility:hidden!important;}',
            'html,body{overflow:hidden!important;}',
        ].join('');
        (document.head||document.documentElement).appendChild(s);
    }

    // Stop audio: visibility:hidden does not pause a playing <video>.
    document.querySelectorAll('video').forEach(function(v){
        try{ v.pause(); }catch(e){}
    });

    if(!document.getElementById('ml-tt-overlay')){
        var o=document.createElement('div');
        o.id='ml-tt-overlay';
        o.setAttribute('style',[
            'position:fixed',
            'top:0','left:0','right:0','bottom:0',
            'z-index:1',
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

    if(!_mlTtScrollLocked){
        window.addEventListener('touchmove',_mlTtBlockTouch,{capture:true,passive:false});
        window.addEventListener('wheel',_mlTtBlockTouch,{capture:true,passive:false});
        _mlTtScrollLocked=true;
        window._mlTtScrollLocked=true;
    }
}

function _mlTtDeactivate(){
    var s=document.getElementById('ml-tt-style');
    if(s&&s.parentNode)s.parentNode.removeChild(s);
    var o=document.getElementById('ml-tt-overlay');
    if(o&&o.parentNode)o.parentNode.removeChild(o);
    if(_mlTtScrollLocked){
        window.removeEventListener('touchmove',_mlTtBlockTouch,{capture:true});
        window.removeEventListener('wheel',_mlTtBlockTouch,{capture:true});
        _mlTtScrollLocked=false;
        window._mlTtScrollLocked=false;
    }
}

if(window._mlTtInterval)clearInterval(window._mlTtInterval);
window._mlTtInterval=setInterval(function(){
    if(_mlTtIsForYou()){
        _mlTtActivate();
    }else{
        _mlTtDeactivate();
    }
},600);
