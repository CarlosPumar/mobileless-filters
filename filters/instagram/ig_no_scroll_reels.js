var _mlReelObs=null;
var _mlReelStyleEl=null;
var _mlReelContainer=null;
var _mlReelType=null;
var _mlReelScrollDesc=null;
var _mlReelEvListeners=[];

// Inject CSS to hide the Reels nav link and suppress the nav tab
(function(){
    if(document.getElementById('ml-reel-nav-hide'))return;
    var s=document.createElement('style');
    s.id='ml-reel-nav-hide';
    s.textContent='a[href="/reels/"]{display:none!important;}';
    (document.head||document.documentElement).appendChild(s);
})();

function _mlHideReelPosts(){
    document.querySelectorAll('a[href*="/reel/"]').forEach(function(a){
        var el=a.closest('article');
        if(el)el.style.setProperty('display','none','important');
    });
}
_mlHideReelPosts();
setInterval(_mlHideReelPosts,1500);

function _mlHasVideo(el){
    return el.querySelectorAll('video').length>0;
}

// A full-screen Reels player always fills (almost) the entire viewport.
// Embedded videos in feed posts, DM threads, or carousels are significantly
// smaller. Requiring >= 85 % of viewport height prevents false positives on
// those elements while still matching the player wherever it appears
// (standalone /reels/, reels opened from DMs, profile reels, etc.).
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
    var tc=_mlFindTransformContainer();
    if(tc){
        _mlReelContainer=tc;
        _mlReelType='transform';
        _mlLockTransform(tc);
        return;
    }
    var sc=_mlFindSnapContainer();
    if(sc){
        _mlReelContainer=sc;
        _mlReelType='snap';
        _mlLockSnap(sc);
        return;
    }
}

function _mlUnlockReels(){
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

setInterval(function(){
    if(_mlReelContainer){
        // Unlock if the container was removed from the DOM OR is no longer
        // a full-screen reel player (e.g. user closed a reel opened from DMs
        // and the overlay shrank/was hidden — but stayed in the DOM tree).
        if(!document.contains(_mlReelContainer)||!_mlIsFullscreenReelContainer(_mlReelContainer)){
            _mlUnlockReels();
        }
    }
    if(!_mlReelContainer){
        _mlLockReels();
    }
},500);
