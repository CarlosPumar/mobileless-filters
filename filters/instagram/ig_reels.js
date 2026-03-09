function _mlHideReelPosts(){
    document.querySelectorAll('a[href*="/reel/"]').forEach(function(a){
        var el=a.closest('article');
        if(el)el.style.setProperty('display','none','important');
    });
}
_mlHideReelPosts();
setInterval(_mlHideReelPosts,1500);
