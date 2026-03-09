function _mlHideStoriesTray(){
    var p=window.location.pathname;
    if(p!=='/'&&p!=='')return;
    var divs=document.querySelectorAll('div');
    for(var i=0;i<divs.length;i++){
        var cs=window.getComputedStyle(divs[i]);
        if(cs.overflowX!=='auto'&&cs.overflowX!=='scroll')continue;
        var rect=divs[i].getBoundingClientRect();
        if(rect.top>200||rect.top<-10)continue;
        if(rect.height<80||rect.height>200)continue;
        var buttons=divs[i].querySelectorAll('[role="button"]');
        if(buttons.length<3)continue;
        divs[i].style.setProperty('display','none','important');
        if(divs[i].parentElement)divs[i].parentElement.style.setProperty('display','none','important');
        return;
    }
}
_mlHideStoriesTray();
setInterval(_mlHideStoriesTray,2000);
