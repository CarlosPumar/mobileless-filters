var _mlReelObs=window._mlReelObs||null;
var _mlReelStyleEl=window._mlReelStyleEl||null;
var _mlReelContainer=window._mlReelContainer||null;
var _mlReelType=window._mlReelType||null;
var _mlReelScrollDesc=window._mlReelScrollDesc||null;
var _mlReelEvListeners=window._mlReelEvListeners||[];
var _mlSwipeTouchStart=window._mlSwipeTouchStart||null;
var _mlSwipeBlocker=window._mlSwipeBlocker||null;
var _mlSwipeStartListener=window._mlSwipeStartListener||null;

// Hide only the Reels nav tab so the user cannot navigate to the /reels/ section.
// Reel posts in the home feed are intentionally left visible — hiding them causes
// Instagram's infinite-scroll to loop endlessly loading more content.
(function(){
    if(document.getElementById('ml-reel-nav-hide'))return;
    var s=document.createElement('style');
    s.id='ml-reel-nav-hide';
    s.textContent='a[href="/reels/"]{display:none!important;}';
    var _rnhParent=document.head||document.documentElement;
    if(_rnhParent)_rnhParent.appendChild(s);
})();

function _mlHasVideo(el){
    return el.querySelectorAll('video').length>0;
}

// A full-screen Reels player always fills (almost) the entire viewport.
// Embedded videos in feed posts, DM threads, or carousels are significantly
// smaller. Requiring >= 85 % of viewport height prevents false positives.
function _mlIsFullscreenReelContainer(el){
    return el.clientHeight>=window.innerHeight*0.85;
}

function _mlFindTransformContainer(){
    var divs=document.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
        if(!_mlIsFullscreenReelContainer(divs[i]))continue;
        var ch=divs[i].children;
        if(ch.length<2)continue;
        var f=ch[0],s=ch[1];
        if(!f||!s)continue;
        var fs=f.getAttribute('style')||'';
        var ss=s.getAttribute('style')||'';
        if(fs.indexOf('transform-origin: center top')<0)continue;
        if(ss.indexOf('transform-origin: center top')<0)continue;
        if(!_mlHasVideo(divs[i]))continue;
        return divs[i];
    }
    return null;
}

function _mlFindSnapContainer(){
    var divs=document.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
        var cs=window.getComputedStyle(divs[i]);
        if(cs.scrollSnapType!=='y mandatory')continue;
        if(divs[i].scrollHeight<=divs[i].clientHeight+50)continue;
        if(!_mlIsFullscreenReelContainer(divs[i]))continue;
        if(!_mlHasVideo(divs[i]))continue;
        return divs[i];
    }
    return null;
}

// Primary swipe blocker — attaches to document in capture phase so Instagram
// never sees the touchmove event. Only blocks vertical gestures (dy > 5px)
// to leave taps (like, comment, follow) completely unaffected.
function _mlInstallSwipeBlocker(){
    if(_mlSwipeBlocker)return;
    _mlSwipeTouchStart=null;
    _mlSwipeStartListener=function(e){
        _mlSwipeTouchStart=e.touches[0].clientY;
    };
    _mlSwipeBlocker=function(e){
        if(_mlSwipeTouchStart===null)return;
        // Never block gestures on Stories or DM paths.
        if(_mlIsStoriesPath())return;
        if(_mlIsInDMs())return;
        // Never block gestures that start outside the detected reel container
        // (e.g. story-upload media picker, post composer, comment fields).
        if(_mlReelContainer&&e.target&&!_mlReelContainer.contains(e.target))return;
        var dy=Math.abs(e.changedTouches[0].clientY-_mlSwipeTouchStart);
        if(dy>5){
            e.preventDefault();
            e.stopPropagation();
        }
    };
    document.addEventListener('touchstart',_mlSwipeStartListener,{capture:true,passive:true});
    document.addEventListener('touchmove',_mlSwipeBlocker,{capture:true,passive:false});
    // Persist references on window so they survive script re-injections
    window._mlSwipeTouchStart=_mlSwipeTouchStart;
    window._mlSwipeBlocker=_mlSwipeBlocker;
    window._mlSwipeStartListener=_mlSwipeStartListener;
}

function _mlRemoveSwipeBlocker(){
    if(_mlSwipeStartListener){
        document.removeEventListener('touchstart',_mlSwipeStartListener,{capture:true});
        _mlSwipeStartListener=null;
        window._mlSwipeStartListener=null;
    }
    if(_mlSwipeBlocker){
        document.removeEventListener('touchmove',_mlSwipeBlocker,{capture:true});
        _mlSwipeBlocker=null;
        window._mlSwipeBlocker=null;
    }
    _mlSwipeTouchStart=null;
    window._mlSwipeTouchStart=null;
}

// Secondary: MutationObserver-based lock for transform containers.
// Watches inline-style changes on reel children and reverts any transform
// mutation back to the recorded initial value.
function _mlLockTransform(c){
    var locked=new Map();
    function addChild(el){
        if(el.nodeType!==1)return;
        var st=el.getAttribute('style')||'';
        if(st.indexOf('transform-origin: center top')>=0){
            locked.set(el,(el.style.transform||''));
            _mlReelObs.observe(el,{attributes:true,attributeFilter:['style']});
        }
    }
    _mlReelObs=new MutationObserver(function(muts){
        muts.forEach(function(m){
            if(m.type==='attributes'&&m.attributeName==='style'){
                var el=m.target;
                if(locked.has(el)){
                    var want=locked.get(el);
                    if(el.style.transform!==want){
                        el.style.transform=want;
                    }
                }
            }else if(m.type==='childList'){
                m.addedNodes.forEach(addChild);
            }
        });
    });
    Array.from(c.children).forEach(addChild);
    _mlReelObs.observe(c,{childList:true});
    if(!_mlReelStyleEl){
        _mlReelStyleEl=document.createElement('style');
        _mlReelStyleEl.id='ml-reel-lock';
        _mlReelStyleEl.textContent='div>div[style*="transform-origin: center top"]{transition:none!important;}';
        (document.head||document.documentElement).appendChild(_mlReelStyleEl);
    }
}

// Secondary: overflow-based lock for snap-scroll containers.
function _mlLockSnap(c){
    var frozenTop=c.scrollTop;
    c.style.setProperty('overflow','hidden','important');
    c.style.setProperty('touch-action','none','important');
    c.style.setProperty('overscroll-behavior','none','important');
    _mlReelScrollDesc=Object.getOwnPropertyDescriptor(Element.prototype,'scrollTop');
    Object.defineProperty(c,'scrollTop',{
        get:function(){return frozenTop;},
        set:function(v){_mlReelScrollDesc.set.call(c,frozenTop);},
        configurable:true
    });
    var blockWheel=function(e){e.preventDefault();e.stopPropagation();};
    var blockTouch=function(e){e.preventDefault();e.stopPropagation();};
    c.addEventListener('wheel',blockWheel,{capture:true,passive:false});
    c.addEventListener('touchmove',blockTouch,{capture:true,passive:false});
    _mlReelEvListeners=[{el:c,type:'wheel',fn:blockWheel},{el:c,type:'touchmove',fn:blockTouch}];
}

function _mlLockReels(){
    if(_mlReelObs||_mlReelType==='snap')return;
    // Never lock in Stories paths — the story creation media picker is a
    // full-screen snap-scroll container with video thumbnails that would be
    // misidentified as the Reels player, blocking swipes in the composer.
    if(_mlIsStoriesPath())return;
    // Never lock in DMs — shared reels and video messages can create fullscreen
    // snap/transform containers that match our heuristics, which would block
    // scrolling through the conversation thread.
    if(_mlIsInDMs())return;
    var tc=_mlFindTransformContainer();
    if(tc){
        _mlReelContainer=tc;
        _mlReelType='transform';
        _mlInstallSwipeBlocker();
        _mlLockTransform(tc);
        return;
    }
    var sc=_mlFindSnapContainer();
    if(sc){
        _mlReelContainer=sc;
        _mlReelType='snap';
        _mlInstallSwipeBlocker();
        _mlLockSnap(sc);
        return;
    }
}

function _mlUnlockReels(){
    _mlRemoveSwipeBlocker();
    if(_mlReelObs){_mlReelObs.disconnect();_mlReelObs=null;}
    if(_mlReelStyleEl&&_mlReelStyleEl.parentNode){_mlReelStyleEl.parentNode.removeChild(_mlReelStyleEl);_mlReelStyleEl=null;}
    if(_mlReelType==='snap'&&_mlReelContainer){
        _mlReelContainer.style.removeProperty('overflow');
        _mlReelContainer.style.removeProperty('touch-action');
        _mlReelContainer.style.removeProperty('overscroll-behavior');
        if(_mlReelScrollDesc){
            Object.defineProperty(_mlReelContainer,'scrollTop',_mlReelScrollDesc);
            _mlReelScrollDesc=null;
        }
    }
    _mlReelEvListeners.forEach(function(l){l.el.removeEventListener(l.type,l.fn,{capture:true});});
    _mlReelEvListeners=[];
    _mlReelContainer=null;
    _mlReelType=null;
}

function _mlCurrentPath(){
    return window.location.pathname.replace(/\/+$/,'')||'/';
}

function _mlIsInDMs(){
    return _mlCurrentPath().indexOf('/direct/')===0;
}

// Exclude story creation and story viewer paths from reel locking.
// These paths use full-screen containers with snap-scroll / video thumbnails
// that would otherwise be misidentified as the Reels player.
function _mlIsStoriesPath(){
    return _mlCurrentPath().indexOf('/stories/')===0;
}

if(window._mlReelLockInterval)clearInterval(window._mlReelLockInterval);
window._mlReelLockInterval=setInterval(function(){
    if(_mlReelContainer){
        if(!document.contains(_mlReelContainer)||!_mlIsFullscreenReelContainer(_mlReelContainer)){
            _mlUnlockReels();
        }
    }
    if(!_mlReelContainer){
        _mlLockReels();
    }
},500);
