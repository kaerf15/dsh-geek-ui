var __pwXterm=(()=>{var De=Object.create;var he=Object.defineProperty;var Re=Object.getOwnPropertyDescriptor;var xe=Object.getOwnPropertyNames;var Ae=Object.getPrototypeOf,Be=Object.prototype.hasOwnProperty;var me=(q,z)=>()=>{try{return z||q((z={exports:{}}).exports,z),z.exports}catch(j){throw z=0,j}},Te=(q,z)=>{for(var j in z)he(q,j,{get:z[j],enumerable:!0})},Se=(q,z,j,J)=>{if(z&&typeof z=="object"||typeof z=="function")for(let O of xe(z))!Be.call(q,O)&&O!==j&&he(q,O,{get:()=>z[O],enumerable:!(J=Re(z,O))||J.enumerable});return q};var Ce=(q,z,j)=>(j=q!=null?De(Ae(q)):{},Se(z||!q||!q.__esModule?he(j,"default",{value:q,enumerable:!0}):j,q)),Me=q=>Se(he({},"__esModule",{value:!0}),q);var ye=me((ce,ge)=>{(function(q,z){if(typeof ce=="object"&&typeof ge=="object")ge.exports=z();else if(typeof define=="function"&&define.amd)define([],z);else{var j=z();for(var J in j)(typeof ce=="object"?ce:q)[J]=j[J]}})(self,(()=>(()=>{"use strict";var q={4567:function(O,r,a){var l=this&&this.__decorate||function(i,o,c,v){var m,h=arguments.length,g=h<3?o:v===null?v=Object.getOwnPropertyDescriptor(o,c):v;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")g=Reflect.decorate(i,o,c,v);else for(var b=i.length-1;b>=0;b--)(m=i[b])&&(g=(h<3?m(g):h>3?m(o,c,g):m(o,c))||g);return h>3&&g&&Object.defineProperty(o,c,g),g},u=this&&this.__param||function(i,o){return function(c,v){o(c,v,i)}};Object.defineProperty(r,"__esModule",{value:!0}),r.AccessibilityManager=void 0;let n=a(9042),d=a(6114),f=a(9924),p=a(844),_=a(5596),e=a(4725),s=a(3656),t=r.AccessibilityManager=class extends p.Disposable{constructor(i,o){super(),this._terminal=i,this._renderService=o,this._liveRegionLineCount=0,this._charsToConsume=[],this._charsToAnnounce="",this._accessibilityContainer=document.createElement("div"),this._accessibilityContainer.classList.add("xterm-accessibility"),this._rowContainer=document.createElement("div"),this._rowContainer.setAttribute("role","list"),this._rowContainer.classList.add("xterm-accessibility-tree"),this._rowElements=[];for(let c=0;c<this._terminal.rows;c++)this._rowElements[c]=this._createAccessibilityTreeNode(),this._rowContainer.appendChild(this._rowElements[c]);if(this._topBoundaryFocusListener=c=>this._handleBoundaryFocus(c,0),this._bottomBoundaryFocusListener=c=>this._handleBoundaryFocus(c,1),this._rowElements[0].addEventListener("focus",this._topBoundaryFocusListener),this._rowElements[this._rowElements.length-1].addEventListener("focus",this._bottomBoundaryFocusListener),this._refreshRowsDimensions(),this._accessibilityContainer.appendChild(this._rowContainer),this._liveRegion=document.createElement("div"),this._liveRegion.classList.add("live-region"),this._liveRegion.setAttribute("aria-live","assertive"),this._accessibilityContainer.appendChild(this._liveRegion),this._liveRegionDebouncer=this.register(new f.TimeBasedDebouncer(this._renderRows.bind(this))),!this._terminal.element)throw new Error("Cannot enable accessibility before Terminal.open");this._terminal.element.insertAdjacentElement("afterbegin",this._accessibilityContainer),this.register(this._terminal.onResize((c=>this._handleResize(c.rows)))),this.register(this._terminal.onRender((c=>this._refreshRows(c.start,c.end)))),this.register(this._terminal.onScroll((()=>this._refreshRows()))),this.register(this._terminal.onA11yChar((c=>this._handleChar(c)))),this.register(this._terminal.onLineFeed((()=>this._handleChar(`
`)))),this.register(this._terminal.onA11yTab((c=>this._handleTab(c)))),this.register(this._terminal.onKey((c=>this._handleKey(c.key)))),this.register(this._terminal.onBlur((()=>this._clearLiveRegion()))),this.register(this._renderService.onDimensionsChange((()=>this._refreshRowsDimensions()))),this._screenDprMonitor=new _.ScreenDprMonitor(window),this.register(this._screenDprMonitor),this._screenDprMonitor.setListener((()=>this._refreshRowsDimensions())),this.register((0,s.addDisposableDomListener)(window,"resize",(()=>this._refreshRowsDimensions()))),this._refreshRows(),this.register((0,p.toDisposable)((()=>{this._accessibilityContainer.remove(),this._rowElements.length=0})))}_handleTab(i){for(let o=0;o<i;o++)this._handleChar(" ")}_handleChar(i){this._liveRegionLineCount<21&&(this._charsToConsume.length>0?this._charsToConsume.shift()!==i&&(this._charsToAnnounce+=i):this._charsToAnnounce+=i,i===`
`&&(this._liveRegionLineCount++,this._liveRegionLineCount===21&&(this._liveRegion.textContent+=n.tooMuchOutput)),d.isMac&&this._liveRegion.textContent&&this._liveRegion.textContent.length>0&&!this._liveRegion.parentNode&&setTimeout((()=>{this._accessibilityContainer.appendChild(this._liveRegion)}),0))}_clearLiveRegion(){this._liveRegion.textContent="",this._liveRegionLineCount=0,d.isMac&&this._liveRegion.remove()}_handleKey(i){this._clearLiveRegion(),/\p{Control}/u.test(i)||this._charsToConsume.push(i)}_refreshRows(i,o){this._liveRegionDebouncer.refresh(i,o,this._terminal.rows)}_renderRows(i,o){let c=this._terminal.buffer,v=c.lines.length.toString();for(let m=i;m<=o;m++){let h=c.translateBufferLineToString(c.ydisp+m,!0),g=(c.ydisp+m+1).toString(),b=this._rowElements[m];b&&(h.length===0?b.innerText="\xA0":b.textContent=h,b.setAttribute("aria-posinset",g),b.setAttribute("aria-setsize",v))}this._announceCharacters()}_announceCharacters(){this._charsToAnnounce.length!==0&&(this._liveRegion.textContent+=this._charsToAnnounce,this._charsToAnnounce="")}_handleBoundaryFocus(i,o){let c=i.target,v=this._rowElements[o===0?1:this._rowElements.length-2];if(c.getAttribute("aria-posinset")===(o===0?"1":`${this._terminal.buffer.lines.length}`)||i.relatedTarget!==v)return;let m,h;if(o===0?(m=c,h=this._rowElements.pop(),this._rowContainer.removeChild(h)):(m=this._rowElements.shift(),h=c,this._rowContainer.removeChild(m)),m.removeEventListener("focus",this._topBoundaryFocusListener),h.removeEventListener("focus",this._bottomBoundaryFocusListener),o===0){let g=this._createAccessibilityTreeNode();this._rowElements.unshift(g),this._rowContainer.insertAdjacentElement("afterbegin",g)}else{let g=this._createAccessibilityTreeNode();this._rowElements.push(g),this._rowContainer.appendChild(g)}this._rowElements[0].addEventListener("focus",this._topBoundaryFocusListener),this._rowElements[this._rowElements.length-1].addEventListener("focus",this._bottomBoundaryFocusListener),this._terminal.scrollLines(o===0?-1:1),this._rowElements[o===0?1:this._rowElements.length-2].focus(),i.preventDefault(),i.stopImmediatePropagation()}_handleResize(i){this._rowElements[this._rowElements.length-1].removeEventListener("focus",this._bottomBoundaryFocusListener);for(let o=this._rowContainer.children.length;o<this._terminal.rows;o++)this._rowElements[o]=this._createAccessibilityTreeNode(),this._rowContainer.appendChild(this._rowElements[o]);for(;this._rowElements.length>i;)this._rowContainer.removeChild(this._rowElements.pop());this._rowElements[this._rowElements.length-1].addEventListener("focus",this._bottomBoundaryFocusListener),this._refreshRowsDimensions()}_createAccessibilityTreeNode(){let i=document.createElement("div");return i.setAttribute("role","listitem"),i.tabIndex=-1,this._refreshRowDimensions(i),i}_refreshRowsDimensions(){if(this._renderService.dimensions.css.cell.height){this._accessibilityContainer.style.width=`${this._renderService.dimensions.css.canvas.width}px`,this._rowElements.length!==this._terminal.rows&&this._handleResize(this._terminal.rows);for(let i=0;i<this._terminal.rows;i++)this._refreshRowDimensions(this._rowElements[i])}}_refreshRowDimensions(i){i.style.height=`${this._renderService.dimensions.css.cell.height}px`}};r.AccessibilityManager=t=l([u(1,e.IRenderService)],t)},3614:(O,r)=>{function a(d){return d.replace(/\r?\n/g,"\r")}function l(d,f){return f?"\x1B[200~"+d+"\x1B[201~":d}function u(d,f,p,_){d=l(d=a(d),p.decPrivateModes.bracketedPasteMode&&_.rawOptions.ignoreBracketedPasteMode!==!0),p.triggerDataEvent(d,!0),f.value=""}function n(d,f,p){let _=p.getBoundingClientRect(),e=d.clientX-_.left-10,s=d.clientY-_.top-10;f.style.width="20px",f.style.height="20px",f.style.left=`${e}px`,f.style.top=`${s}px`,f.style.zIndex="1000",f.focus()}Object.defineProperty(r,"__esModule",{value:!0}),r.rightClickHandler=r.moveTextAreaUnderMouseCursor=r.paste=r.handlePasteEvent=r.copyHandler=r.bracketTextForPaste=r.prepareTextForTerminal=void 0,r.prepareTextForTerminal=a,r.bracketTextForPaste=l,r.copyHandler=function(d,f){d.clipboardData&&d.clipboardData.setData("text/plain",f.selectionText),d.preventDefault()},r.handlePasteEvent=function(d,f,p,_){d.stopPropagation(),d.clipboardData&&u(d.clipboardData.getData("text/plain"),f,p,_)},r.paste=u,r.moveTextAreaUnderMouseCursor=n,r.rightClickHandler=function(d,f,p,_,e){n(d,f,p),e&&_.rightClickSelect(d),f.value=_.selectionText,f.select()}},7239:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.ColorContrastCache=void 0;let l=a(1505);r.ColorContrastCache=class{constructor(){this._color=new l.TwoKeyMap,this._css=new l.TwoKeyMap}setCss(u,n,d){this._css.set(u,n,d)}getCss(u,n){return this._css.get(u,n)}setColor(u,n,d){this._color.set(u,n,d)}getColor(u,n){return this._color.get(u,n)}clear(){this._color.clear(),this._css.clear()}}},3656:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.addDisposableDomListener=void 0,r.addDisposableDomListener=function(a,l,u,n){a.addEventListener(l,u,n);let d=!1;return{dispose:()=>{d||(d=!0,a.removeEventListener(l,u,n))}}}},6465:function(O,r,a){var l=this&&this.__decorate||function(e,s,t,i){var o,c=arguments.length,v=c<3?s:i===null?i=Object.getOwnPropertyDescriptor(s,t):i;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")v=Reflect.decorate(e,s,t,i);else for(var m=e.length-1;m>=0;m--)(o=e[m])&&(v=(c<3?o(v):c>3?o(s,t,v):o(s,t))||v);return c>3&&v&&Object.defineProperty(s,t,v),v},u=this&&this.__param||function(e,s){return function(t,i){s(t,i,e)}};Object.defineProperty(r,"__esModule",{value:!0}),r.Linkifier2=void 0;let n=a(3656),d=a(8460),f=a(844),p=a(2585),_=r.Linkifier2=class extends f.Disposable{get currentLink(){return this._currentLink}constructor(e){super(),this._bufferService=e,this._linkProviders=[],this._linkCacheDisposables=[],this._isMouseOut=!0,this._wasResized=!1,this._activeLine=-1,this._onShowLinkUnderline=this.register(new d.EventEmitter),this.onShowLinkUnderline=this._onShowLinkUnderline.event,this._onHideLinkUnderline=this.register(new d.EventEmitter),this.onHideLinkUnderline=this._onHideLinkUnderline.event,this.register((0,f.getDisposeArrayDisposable)(this._linkCacheDisposables)),this.register((0,f.toDisposable)((()=>{this._lastMouseEvent=void 0}))),this.register(this._bufferService.onResize((()=>{this._clearCurrentLink(),this._wasResized=!0})))}registerLinkProvider(e){return this._linkProviders.push(e),{dispose:()=>{let s=this._linkProviders.indexOf(e);s!==-1&&this._linkProviders.splice(s,1)}}}attachToDom(e,s,t){this._element=e,this._mouseService=s,this._renderService=t,this.register((0,n.addDisposableDomListener)(this._element,"mouseleave",(()=>{this._isMouseOut=!0,this._clearCurrentLink()}))),this.register((0,n.addDisposableDomListener)(this._element,"mousemove",this._handleMouseMove.bind(this))),this.register((0,n.addDisposableDomListener)(this._element,"mousedown",this._handleMouseDown.bind(this))),this.register((0,n.addDisposableDomListener)(this._element,"mouseup",this._handleMouseUp.bind(this)))}_handleMouseMove(e){if(this._lastMouseEvent=e,!this._element||!this._mouseService)return;let s=this._positionFromMouseEvent(e,this._element,this._mouseService);if(!s)return;this._isMouseOut=!1;let t=e.composedPath();for(let i=0;i<t.length;i++){let o=t[i];if(o.classList.contains("xterm"))break;if(o.classList.contains("xterm-hover"))return}this._lastBufferCell&&s.x===this._lastBufferCell.x&&s.y===this._lastBufferCell.y||(this._handleHover(s),this._lastBufferCell=s)}_handleHover(e){if(this._activeLine!==e.y||this._wasResized)return this._clearCurrentLink(),this._askForLink(e,!1),void(this._wasResized=!1);this._currentLink&&this._linkAtPosition(this._currentLink.link,e)||(this._clearCurrentLink(),this._askForLink(e,!0))}_askForLink(e,s){var t,i;this._activeProviderReplies&&s||((t=this._activeProviderReplies)===null||t===void 0||t.forEach((c=>{c?.forEach((v=>{v.link.dispose&&v.link.dispose()}))})),this._activeProviderReplies=new Map,this._activeLine=e.y);let o=!1;for(let[c,v]of this._linkProviders.entries())s?!((i=this._activeProviderReplies)===null||i===void 0)&&i.get(c)&&(o=this._checkLinkProviderResult(c,e,o)):v.provideLinks(e.y,(m=>{var h,g;if(this._isMouseOut)return;let b=m?.map((L=>({link:L})));(h=this._activeProviderReplies)===null||h===void 0||h.set(c,b),o=this._checkLinkProviderResult(c,e,o),((g=this._activeProviderReplies)===null||g===void 0?void 0:g.size)===this._linkProviders.length&&this._removeIntersectingLinks(e.y,this._activeProviderReplies)}))}_removeIntersectingLinks(e,s){let t=new Set;for(let i=0;i<s.size;i++){let o=s.get(i);if(o)for(let c=0;c<o.length;c++){let v=o[c],m=v.link.range.start.y<e?0:v.link.range.start.x,h=v.link.range.end.y>e?this._bufferService.cols:v.link.range.end.x;for(let g=m;g<=h;g++){if(t.has(g)){o.splice(c--,1);break}t.add(g)}}}}_checkLinkProviderResult(e,s,t){var i;if(!this._activeProviderReplies)return t;let o=this._activeProviderReplies.get(e),c=!1;for(let v=0;v<e;v++)this._activeProviderReplies.has(v)&&!this._activeProviderReplies.get(v)||(c=!0);if(!c&&o){let v=o.find((m=>this._linkAtPosition(m.link,s)));v&&(t=!0,this._handleNewLink(v))}if(this._activeProviderReplies.size===this._linkProviders.length&&!t)for(let v=0;v<this._activeProviderReplies.size;v++){let m=(i=this._activeProviderReplies.get(v))===null||i===void 0?void 0:i.find((h=>this._linkAtPosition(h.link,s)));if(m){t=!0,this._handleNewLink(m);break}}return t}_handleMouseDown(){this._mouseDownLink=this._currentLink}_handleMouseUp(e){if(!this._element||!this._mouseService||!this._currentLink)return;let s=this._positionFromMouseEvent(e,this._element,this._mouseService);s&&this._mouseDownLink===this._currentLink&&this._linkAtPosition(this._currentLink.link,s)&&this._currentLink.link.activate(e,this._currentLink.link.text)}_clearCurrentLink(e,s){this._element&&this._currentLink&&this._lastMouseEvent&&(!e||!s||this._currentLink.link.range.start.y>=e&&this._currentLink.link.range.end.y<=s)&&(this._linkLeave(this._element,this._currentLink.link,this._lastMouseEvent),this._currentLink=void 0,(0,f.disposeArray)(this._linkCacheDisposables))}_handleNewLink(e){if(!this._element||!this._lastMouseEvent||!this._mouseService)return;let s=this._positionFromMouseEvent(this._lastMouseEvent,this._element,this._mouseService);s&&this._linkAtPosition(e.link,s)&&(this._currentLink=e,this._currentLink.state={decorations:{underline:e.link.decorations===void 0||e.link.decorations.underline,pointerCursor:e.link.decorations===void 0||e.link.decorations.pointerCursor},isHovered:!0},this._linkHover(this._element,e.link,this._lastMouseEvent),e.link.decorations={},Object.defineProperties(e.link.decorations,{pointerCursor:{get:()=>{var t,i;return(i=(t=this._currentLink)===null||t===void 0?void 0:t.state)===null||i===void 0?void 0:i.decorations.pointerCursor},set:t=>{var i,o;!((i=this._currentLink)===null||i===void 0)&&i.state&&this._currentLink.state.decorations.pointerCursor!==t&&(this._currentLink.state.decorations.pointerCursor=t,this._currentLink.state.isHovered&&((o=this._element)===null||o===void 0||o.classList.toggle("xterm-cursor-pointer",t)))}},underline:{get:()=>{var t,i;return(i=(t=this._currentLink)===null||t===void 0?void 0:t.state)===null||i===void 0?void 0:i.decorations.underline},set:t=>{var i,o,c;!((i=this._currentLink)===null||i===void 0)&&i.state&&((c=(o=this._currentLink)===null||o===void 0?void 0:o.state)===null||c===void 0?void 0:c.decorations.underline)!==t&&(this._currentLink.state.decorations.underline=t,this._currentLink.state.isHovered&&this._fireUnderlineEvent(e.link,t))}}}),this._renderService&&this._linkCacheDisposables.push(this._renderService.onRenderedViewportChange((t=>{if(!this._currentLink)return;let i=t.start===0?0:t.start+1+this._bufferService.buffer.ydisp,o=this._bufferService.buffer.ydisp+1+t.end;if(this._currentLink.link.range.start.y>=i&&this._currentLink.link.range.end.y<=o&&(this._clearCurrentLink(i,o),this._lastMouseEvent&&this._element)){let c=this._positionFromMouseEvent(this._lastMouseEvent,this._element,this._mouseService);c&&this._askForLink(c,!1)}}))))}_linkHover(e,s,t){var i;!((i=this._currentLink)===null||i===void 0)&&i.state&&(this._currentLink.state.isHovered=!0,this._currentLink.state.decorations.underline&&this._fireUnderlineEvent(s,!0),this._currentLink.state.decorations.pointerCursor&&e.classList.add("xterm-cursor-pointer")),s.hover&&s.hover(t,s.text)}_fireUnderlineEvent(e,s){let t=e.range,i=this._bufferService.buffer.ydisp,o=this._createLinkUnderlineEvent(t.start.x-1,t.start.y-i-1,t.end.x,t.end.y-i-1,void 0);(s?this._onShowLinkUnderline:this._onHideLinkUnderline).fire(o)}_linkLeave(e,s,t){var i;!((i=this._currentLink)===null||i===void 0)&&i.state&&(this._currentLink.state.isHovered=!1,this._currentLink.state.decorations.underline&&this._fireUnderlineEvent(s,!1),this._currentLink.state.decorations.pointerCursor&&e.classList.remove("xterm-cursor-pointer")),s.leave&&s.leave(t,s.text)}_linkAtPosition(e,s){let t=e.range.start.y*this._bufferService.cols+e.range.start.x,i=e.range.end.y*this._bufferService.cols+e.range.end.x,o=s.y*this._bufferService.cols+s.x;return t<=o&&o<=i}_positionFromMouseEvent(e,s,t){let i=t.getCoords(e,s,this._bufferService.cols,this._bufferService.rows);if(i)return{x:i[0],y:i[1]+this._bufferService.buffer.ydisp}}_createLinkUnderlineEvent(e,s,t,i,o){return{x1:e,y1:s,x2:t,y2:i,cols:this._bufferService.cols,fg:o}}};r.Linkifier2=_=l([u(0,p.IBufferService)],_)},9042:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.tooMuchOutput=r.promptLabel=void 0,r.promptLabel="Terminal input",r.tooMuchOutput="Too much output to announce, navigate to rows manually to read"},3730:function(O,r,a){var l=this&&this.__decorate||function(_,e,s,t){var i,o=arguments.length,c=o<3?e:t===null?t=Object.getOwnPropertyDescriptor(e,s):t;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")c=Reflect.decorate(_,e,s,t);else for(var v=_.length-1;v>=0;v--)(i=_[v])&&(c=(o<3?i(c):o>3?i(e,s,c):i(e,s))||c);return o>3&&c&&Object.defineProperty(e,s,c),c},u=this&&this.__param||function(_,e){return function(s,t){e(s,t,_)}};Object.defineProperty(r,"__esModule",{value:!0}),r.OscLinkProvider=void 0;let n=a(511),d=a(2585),f=r.OscLinkProvider=class{constructor(_,e,s){this._bufferService=_,this._optionsService=e,this._oscLinkService=s}provideLinks(_,e){var s;let t=this._bufferService.buffer.lines.get(_-1);if(!t)return void e(void 0);let i=[],o=this._optionsService.rawOptions.linkHandler,c=new n.CellData,v=t.getTrimmedLength(),m=-1,h=-1,g=!1;for(let b=0;b<v;b++)if(h!==-1||t.hasContent(b)){if(t.loadCell(b,c),c.hasExtendedAttrs()&&c.extended.urlId){if(h===-1){h=b,m=c.extended.urlId;continue}g=c.extended.urlId!==m}else h!==-1&&(g=!0);if(g||h!==-1&&b===v-1){let L=(s=this._oscLinkService.getLinkData(m))===null||s===void 0?void 0:s.uri;if(L){let y={start:{x:h+1,y:_},end:{x:b+(g||b!==v-1?0:1),y:_}},k=!1;if(!o?.allowNonHttpProtocols)try{let x=new URL(L);["http:","https:"].includes(x.protocol)||(k=!0)}catch{k=!0}k||i.push({text:L,range:y,activate:(x,T)=>o?o.activate(x,T,y):p(0,T),hover:(x,T)=>{var P;return(P=o?.hover)===null||P===void 0?void 0:P.call(o,x,T,y)},leave:(x,T)=>{var P;return(P=o?.leave)===null||P===void 0?void 0:P.call(o,x,T,y)}})}g=!1,c.hasExtendedAttrs()&&c.extended.urlId?(h=b,m=c.extended.urlId):(h=-1,m=-1)}}e(i)}};function p(_,e){if(confirm(`Do you want to navigate to ${e}?

WARNING: This link could potentially be dangerous`)){let s=window.open();if(s){try{s.opener=null}catch{}s.location.href=e}else console.warn("Opening link blocked as opener could not be cleared")}}r.OscLinkProvider=f=l([u(0,d.IBufferService),u(1,d.IOptionsService),u(2,d.IOscLinkService)],f)},6193:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.RenderDebouncer=void 0,r.RenderDebouncer=class{constructor(a,l){this._parentWindow=a,this._renderCallback=l,this._refreshCallbacks=[]}dispose(){this._animationFrame&&(this._parentWindow.cancelAnimationFrame(this._animationFrame),this._animationFrame=void 0)}addRefreshCallback(a){return this._refreshCallbacks.push(a),this._animationFrame||(this._animationFrame=this._parentWindow.requestAnimationFrame((()=>this._innerRefresh()))),this._animationFrame}refresh(a,l,u){this._rowCount=u,a=a!==void 0?a:0,l=l!==void 0?l:this._rowCount-1,this._rowStart=this._rowStart!==void 0?Math.min(this._rowStart,a):a,this._rowEnd=this._rowEnd!==void 0?Math.max(this._rowEnd,l):l,this._animationFrame||(this._animationFrame=this._parentWindow.requestAnimationFrame((()=>this._innerRefresh())))}_innerRefresh(){if(this._animationFrame=void 0,this._rowStart===void 0||this._rowEnd===void 0||this._rowCount===void 0)return void this._runRefreshCallbacks();let a=Math.max(this._rowStart,0),l=Math.min(this._rowEnd,this._rowCount-1);this._rowStart=void 0,this._rowEnd=void 0,this._renderCallback(a,l),this._runRefreshCallbacks()}_runRefreshCallbacks(){for(let a of this._refreshCallbacks)a(0);this._refreshCallbacks=[]}}},5596:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.ScreenDprMonitor=void 0;let l=a(844);class u extends l.Disposable{constructor(d){super(),this._parentWindow=d,this._currentDevicePixelRatio=this._parentWindow.devicePixelRatio,this.register((0,l.toDisposable)((()=>{this.clearListener()})))}setListener(d){this._listener&&this.clearListener(),this._listener=d,this._outerListener=()=>{this._listener&&(this._listener(this._parentWindow.devicePixelRatio,this._currentDevicePixelRatio),this._updateDpr())},this._updateDpr()}_updateDpr(){var d;this._outerListener&&((d=this._resolutionMediaMatchList)===null||d===void 0||d.removeListener(this._outerListener),this._currentDevicePixelRatio=this._parentWindow.devicePixelRatio,this._resolutionMediaMatchList=this._parentWindow.matchMedia(`screen and (resolution: ${this._parentWindow.devicePixelRatio}dppx)`),this._resolutionMediaMatchList.addListener(this._outerListener))}clearListener(){this._resolutionMediaMatchList&&this._listener&&this._outerListener&&(this._resolutionMediaMatchList.removeListener(this._outerListener),this._resolutionMediaMatchList=void 0,this._listener=void 0,this._outerListener=void 0)}}r.ScreenDprMonitor=u},3236:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.Terminal=void 0;let l=a(3614),u=a(3656),n=a(6465),d=a(9042),f=a(3730),p=a(1680),_=a(3107),e=a(5744),s=a(2950),t=a(1296),i=a(428),o=a(4269),c=a(5114),v=a(8934),m=a(3230),h=a(9312),g=a(4725),b=a(6731),L=a(8055),y=a(8969),k=a(8460),x=a(844),T=a(6114),P=a(8437),M=a(2584),C=a(7399),w=a(5941),E=a(9074),D=a(2585),I=a(5435),H=a(4567),U=typeof window<"u"?window.document:null;class W extends y.CoreTerminal{get onFocus(){return this._onFocus.event}get onBlur(){return this._onBlur.event}get onA11yChar(){return this._onA11yCharEmitter.event}get onA11yTab(){return this._onA11yTabEmitter.event}get onWillOpen(){return this._onWillOpen.event}constructor(S={}){super(S),this.browser=T,this._keyDownHandled=!1,this._keyDownSeen=!1,this._keyPressHandled=!1,this._unprocessedDeadKey=!1,this._accessibilityManager=this.register(new x.MutableDisposable),this._onCursorMove=this.register(new k.EventEmitter),this.onCursorMove=this._onCursorMove.event,this._onKey=this.register(new k.EventEmitter),this.onKey=this._onKey.event,this._onRender=this.register(new k.EventEmitter),this.onRender=this._onRender.event,this._onSelectionChange=this.register(new k.EventEmitter),this.onSelectionChange=this._onSelectionChange.event,this._onTitleChange=this.register(new k.EventEmitter),this.onTitleChange=this._onTitleChange.event,this._onBell=this.register(new k.EventEmitter),this.onBell=this._onBell.event,this._onFocus=this.register(new k.EventEmitter),this._onBlur=this.register(new k.EventEmitter),this._onA11yCharEmitter=this.register(new k.EventEmitter),this._onA11yTabEmitter=this.register(new k.EventEmitter),this._onWillOpen=this.register(new k.EventEmitter),this._setup(),this.linkifier2=this.register(this._instantiationService.createInstance(n.Linkifier2)),this.linkifier2.registerLinkProvider(this._instantiationService.createInstance(f.OscLinkProvider)),this._decorationService=this._instantiationService.createInstance(E.DecorationService),this._instantiationService.setService(D.IDecorationService,this._decorationService),this.register(this._inputHandler.onRequestBell((()=>this._onBell.fire()))),this.register(this._inputHandler.onRequestRefreshRows(((R,B)=>this.refresh(R,B)))),this.register(this._inputHandler.onRequestSendFocus((()=>this._reportFocus()))),this.register(this._inputHandler.onRequestReset((()=>this.reset()))),this.register(this._inputHandler.onRequestWindowsOptionsReport((R=>this._reportWindowsOptions(R)))),this.register(this._inputHandler.onColor((R=>this._handleColorEvent(R)))),this.register((0,k.forwardEvent)(this._inputHandler.onCursorMove,this._onCursorMove)),this.register((0,k.forwardEvent)(this._inputHandler.onTitleChange,this._onTitleChange)),this.register((0,k.forwardEvent)(this._inputHandler.onA11yChar,this._onA11yCharEmitter)),this.register((0,k.forwardEvent)(this._inputHandler.onA11yTab,this._onA11yTabEmitter)),this.register(this._bufferService.onResize((R=>this._afterResize(R.cols,R.rows)))),this.register((0,x.toDisposable)((()=>{var R,B;this._customKeyEventHandler=void 0,(B=(R=this.element)===null||R===void 0?void 0:R.parentNode)===null||B===void 0||B.removeChild(this.element)})))}_handleColorEvent(S){if(this._themeService)for(let R of S){let B,A="";switch(R.index){case 256:B="foreground",A="10";break;case 257:B="background",A="11";break;case 258:B="cursor",A="12";break;default:B="ansi",A="4;"+R.index}switch(R.type){case 0:let N=L.color.toColorRGB(B==="ansi"?this._themeService.colors.ansi[R.index]:this._themeService.colors[B]);this.coreService.triggerDataEvent(`${M.C0.ESC}]${A};${(0,w.toRgbString)(N)}${M.C1_ESCAPED.ST}`);break;case 1:if(B==="ansi")this._themeService.modifyColors((F=>F.ansi[R.index]=L.rgba.toColor(...R.color)));else{let F=B;this._themeService.modifyColors((K=>K[F]=L.rgba.toColor(...R.color)))}break;case 2:this._themeService.restoreColor(R.index)}}}_setup(){super._setup(),this._customKeyEventHandler=void 0}get buffer(){return this.buffers.active}focus(){this.textarea&&this.textarea.focus({preventScroll:!0})}_handleScreenReaderModeOptionChange(S){S?!this._accessibilityManager.value&&this._renderService&&(this._accessibilityManager.value=this._instantiationService.createInstance(H.AccessibilityManager,this)):this._accessibilityManager.clear()}_handleTextAreaFocus(S){this.coreService.decPrivateModes.sendFocus&&this.coreService.triggerDataEvent(M.C0.ESC+"[I"),this.updateCursorStyle(S),this.element.classList.add("focus"),this._showCursor(),this._onFocus.fire()}blur(){var S;return(S=this.textarea)===null||S===void 0?void 0:S.blur()}_handleTextAreaBlur(){this.textarea.value="",this.refresh(this.buffer.y,this.buffer.y),this.coreService.decPrivateModes.sendFocus&&this.coreService.triggerDataEvent(M.C0.ESC+"[O"),this.element.classList.remove("focus"),this._onBlur.fire()}_syncTextArea(){if(!this.textarea||!this.buffer.isCursorInViewport||this._compositionHelper.isComposing||!this._renderService)return;let S=this.buffer.ybase+this.buffer.y,R=this.buffer.lines.get(S);if(!R)return;let B=Math.min(this.buffer.x,this.cols-1),A=this._renderService.dimensions.css.cell.height,N=R.getWidth(B),F=this._renderService.dimensions.css.cell.width*N,K=this.buffer.y*this._renderService.dimensions.css.cell.height,X=B*this._renderService.dimensions.css.cell.width;this.textarea.style.left=X+"px",this.textarea.style.top=K+"px",this.textarea.style.width=F+"px",this.textarea.style.height=A+"px",this.textarea.style.lineHeight=A+"px",this.textarea.style.zIndex="-5"}_initGlobal(){this._bindKeys(),this.register((0,u.addDisposableDomListener)(this.element,"copy",(R=>{this.hasSelection()&&(0,l.copyHandler)(R,this._selectionService)})));let S=R=>(0,l.handlePasteEvent)(R,this.textarea,this.coreService,this.optionsService);this.register((0,u.addDisposableDomListener)(this.textarea,"paste",S)),this.register((0,u.addDisposableDomListener)(this.element,"paste",S)),T.isFirefox?this.register((0,u.addDisposableDomListener)(this.element,"mousedown",(R=>{R.button===2&&(0,l.rightClickHandler)(R,this.textarea,this.screenElement,this._selectionService,this.options.rightClickSelectsWord)}))):this.register((0,u.addDisposableDomListener)(this.element,"contextmenu",(R=>{(0,l.rightClickHandler)(R,this.textarea,this.screenElement,this._selectionService,this.options.rightClickSelectsWord)}))),T.isLinux&&this.register((0,u.addDisposableDomListener)(this.element,"auxclick",(R=>{R.button===1&&(0,l.moveTextAreaUnderMouseCursor)(R,this.textarea,this.screenElement)})))}_bindKeys(){this.register((0,u.addDisposableDomListener)(this.textarea,"keyup",(S=>this._keyUp(S)),!0)),this.register((0,u.addDisposableDomListener)(this.textarea,"keydown",(S=>this._keyDown(S)),!0)),this.register((0,u.addDisposableDomListener)(this.textarea,"keypress",(S=>this._keyPress(S)),!0)),this.register((0,u.addDisposableDomListener)(this.textarea,"compositionstart",(()=>this._compositionHelper.compositionstart()))),this.register((0,u.addDisposableDomListener)(this.textarea,"compositionupdate",(S=>this._compositionHelper.compositionupdate(S)))),this.register((0,u.addDisposableDomListener)(this.textarea,"compositionend",(()=>this._compositionHelper.compositionend()))),this.register((0,u.addDisposableDomListener)(this.textarea,"input",(S=>this._inputEvent(S)),!0)),this.register(this.onRender((()=>this._compositionHelper.updateCompositionElements())))}open(S){var R;if(!S)throw new Error("Terminal requires a parent element.");S.isConnected||this._logService.debug("Terminal.open was called on an element that was not attached to the DOM"),this._document=S.ownerDocument,this.element=this._document.createElement("div"),this.element.dir="ltr",this.element.classList.add("terminal"),this.element.classList.add("xterm"),S.appendChild(this.element);let B=U.createDocumentFragment();this._viewportElement=U.createElement("div"),this._viewportElement.classList.add("xterm-viewport"),B.appendChild(this._viewportElement),this._viewportScrollArea=U.createElement("div"),this._viewportScrollArea.classList.add("xterm-scroll-area"),this._viewportElement.appendChild(this._viewportScrollArea),this.screenElement=U.createElement("div"),this.screenElement.classList.add("xterm-screen"),this._helperContainer=U.createElement("div"),this._helperContainer.classList.add("xterm-helpers"),this.screenElement.appendChild(this._helperContainer),B.appendChild(this.screenElement),this.textarea=U.createElement("textarea"),this.textarea.classList.add("xterm-helper-textarea"),this.textarea.setAttribute("aria-label",d.promptLabel),T.isChromeOS||this.textarea.setAttribute("aria-multiline","false"),this.textarea.setAttribute("autocorrect","off"),this.textarea.setAttribute("autocapitalize","off"),this.textarea.setAttribute("spellcheck","false"),this.textarea.tabIndex=0,this._coreBrowserService=this._instantiationService.createInstance(c.CoreBrowserService,this.textarea,(R=this._document.defaultView)!==null&&R!==void 0?R:window),this._instantiationService.setService(g.ICoreBrowserService,this._coreBrowserService),this.register((0,u.addDisposableDomListener)(this.textarea,"focus",(A=>this._handleTextAreaFocus(A)))),this.register((0,u.addDisposableDomListener)(this.textarea,"blur",(()=>this._handleTextAreaBlur()))),this._helperContainer.appendChild(this.textarea),this._charSizeService=this._instantiationService.createInstance(i.CharSizeService,this._document,this._helperContainer),this._instantiationService.setService(g.ICharSizeService,this._charSizeService),this._themeService=this._instantiationService.createInstance(b.ThemeService),this._instantiationService.setService(g.IThemeService,this._themeService),this._characterJoinerService=this._instantiationService.createInstance(o.CharacterJoinerService),this._instantiationService.setService(g.ICharacterJoinerService,this._characterJoinerService),this._renderService=this.register(this._instantiationService.createInstance(m.RenderService,this.rows,this.screenElement)),this._instantiationService.setService(g.IRenderService,this._renderService),this.register(this._renderService.onRenderedViewportChange((A=>this._onRender.fire(A)))),this.onResize((A=>this._renderService.resize(A.cols,A.rows))),this._compositionView=U.createElement("div"),this._compositionView.classList.add("composition-view"),this._compositionHelper=this._instantiationService.createInstance(s.CompositionHelper,this.textarea,this._compositionView),this._helperContainer.appendChild(this._compositionView),this.element.appendChild(B);try{this._onWillOpen.fire(this.element)}catch{}this._renderService.hasRenderer()||this._renderService.setRenderer(this._createRenderer()),this._mouseService=this._instantiationService.createInstance(v.MouseService),this._instantiationService.setService(g.IMouseService,this._mouseService),this.viewport=this._instantiationService.createInstance(p.Viewport,this._viewportElement,this._viewportScrollArea),this.viewport.onRequestScrollLines((A=>this.scrollLines(A.amount,A.suppressScrollEvent,1))),this.register(this._inputHandler.onRequestSyncScrollBar((()=>this.viewport.syncScrollArea()))),this.register(this.viewport),this.register(this.onCursorMove((()=>{this._renderService.handleCursorMove(),this._syncTextArea()}))),this.register(this.onResize((()=>this._renderService.handleResize(this.cols,this.rows)))),this.register(this.onBlur((()=>this._renderService.handleBlur()))),this.register(this.onFocus((()=>this._renderService.handleFocus()))),this.register(this._renderService.onDimensionsChange((()=>this.viewport.syncScrollArea()))),this._selectionService=this.register(this._instantiationService.createInstance(h.SelectionService,this.element,this.screenElement,this.linkifier2)),this._instantiationService.setService(g.ISelectionService,this._selectionService),this.register(this._selectionService.onRequestScrollLines((A=>this.scrollLines(A.amount,A.suppressScrollEvent)))),this.register(this._selectionService.onSelectionChange((()=>this._onSelectionChange.fire()))),this.register(this._selectionService.onRequestRedraw((A=>this._renderService.handleSelectionChanged(A.start,A.end,A.columnSelectMode)))),this.register(this._selectionService.onLinuxMouseSelection((A=>{this.textarea.value=A,this.textarea.focus(),this.textarea.select()}))),this.register(this._onScroll.event((A=>{this.viewport.syncScrollArea(),this._selectionService.refresh()}))),this.register((0,u.addDisposableDomListener)(this._viewportElement,"scroll",(()=>this._selectionService.refresh()))),this.linkifier2.attachToDom(this.screenElement,this._mouseService,this._renderService),this.register(this._instantiationService.createInstance(_.BufferDecorationRenderer,this.screenElement)),this.register((0,u.addDisposableDomListener)(this.element,"mousedown",(A=>this._selectionService.handleMouseDown(A)))),this.coreMouseService.areMouseEventsActive?(this._selectionService.disable(),this.element.classList.add("enable-mouse-events")):this._selectionService.enable(),this.options.screenReaderMode&&(this._accessibilityManager.value=this._instantiationService.createInstance(H.AccessibilityManager,this)),this.register(this.optionsService.onSpecificOptionChange("screenReaderMode",(A=>this._handleScreenReaderModeOptionChange(A)))),this.options.overviewRulerWidth&&(this._overviewRulerRenderer=this.register(this._instantiationService.createInstance(e.OverviewRulerRenderer,this._viewportElement,this.screenElement))),this.optionsService.onSpecificOptionChange("overviewRulerWidth",(A=>{!this._overviewRulerRenderer&&A&&this._viewportElement&&this.screenElement&&(this._overviewRulerRenderer=this.register(this._instantiationService.createInstance(e.OverviewRulerRenderer,this._viewportElement,this.screenElement)))})),this._charSizeService.measure(),this.refresh(0,this.rows-1),this._initGlobal(),this.bindMouse()}_createRenderer(){return this._instantiationService.createInstance(t.DomRenderer,this.element,this.screenElement,this._viewportElement,this.linkifier2)}bindMouse(){let S=this,R=this.element;function B(F){let K=S._mouseService.getMouseReportCoords(F,S.screenElement);if(!K)return!1;let X,Y;switch(F.overrideType||F.type){case"mousemove":Y=32,F.buttons===void 0?(X=3,F.button!==void 0&&(X=F.button<3?F.button:3)):X=1&F.buttons?0:4&F.buttons?1:2&F.buttons?2:3;break;case"mouseup":Y=0,X=F.button<3?F.button:3;break;case"mousedown":Y=1,X=F.button<3?F.button:3;break;case"wheel":if(S.viewport.getLinesScrolled(F)===0)return!1;Y=F.deltaY<0?0:1,X=4;break;default:return!1}return!(Y===void 0||X===void 0||X>4)&&S.coreMouseService.triggerMouseEvent({col:K.col,row:K.row,x:K.x,y:K.y,button:X,action:Y,ctrl:F.ctrlKey,alt:F.altKey,shift:F.shiftKey})}let A={mouseup:null,wheel:null,mousedrag:null,mousemove:null},N={mouseup:F=>(B(F),F.buttons||(this._document.removeEventListener("mouseup",A.mouseup),A.mousedrag&&this._document.removeEventListener("mousemove",A.mousedrag)),this.cancel(F)),wheel:F=>(B(F),this.cancel(F,!0)),mousedrag:F=>{F.buttons&&B(F)},mousemove:F=>{F.buttons||B(F)}};this.register(this.coreMouseService.onProtocolChange((F=>{F?(this.optionsService.rawOptions.logLevel==="debug"&&this._logService.debug("Binding to mouse events:",this.coreMouseService.explainEvents(F)),this.element.classList.add("enable-mouse-events"),this._selectionService.disable()):(this._logService.debug("Unbinding from mouse events."),this.element.classList.remove("enable-mouse-events"),this._selectionService.enable()),8&F?A.mousemove||(R.addEventListener("mousemove",N.mousemove),A.mousemove=N.mousemove):(R.removeEventListener("mousemove",A.mousemove),A.mousemove=null),16&F?A.wheel||(R.addEventListener("wheel",N.wheel,{passive:!1}),A.wheel=N.wheel):(R.removeEventListener("wheel",A.wheel),A.wheel=null),2&F?A.mouseup||(R.addEventListener("mouseup",N.mouseup),A.mouseup=N.mouseup):(this._document.removeEventListener("mouseup",A.mouseup),R.removeEventListener("mouseup",A.mouseup),A.mouseup=null),4&F?A.mousedrag||(A.mousedrag=N.mousedrag):(this._document.removeEventListener("mousemove",A.mousedrag),A.mousedrag=null)}))),this.coreMouseService.activeProtocol=this.coreMouseService.activeProtocol,this.register((0,u.addDisposableDomListener)(R,"mousedown",(F=>{if(F.preventDefault(),this.focus(),this.coreMouseService.areMouseEventsActive&&!this._selectionService.shouldForceSelection(F))return B(F),A.mouseup&&this._document.addEventListener("mouseup",A.mouseup),A.mousedrag&&this._document.addEventListener("mousemove",A.mousedrag),this.cancel(F)}))),this.register((0,u.addDisposableDomListener)(R,"wheel",(F=>{if(!A.wheel){if(!this.buffer.hasScrollback){let K=this.viewport.getLinesScrolled(F);if(K===0)return;let X=M.C0.ESC+(this.coreService.decPrivateModes.applicationCursorKeys?"O":"[")+(F.deltaY<0?"A":"B"),Y="";for(let ie=0;ie<Math.abs(K);ie++)Y+=X;return this.coreService.triggerDataEvent(Y,!0),this.cancel(F,!0)}return this.viewport.handleWheel(F)?this.cancel(F):void 0}}),{passive:!1})),this.register((0,u.addDisposableDomListener)(R,"touchstart",(F=>{if(!this.coreMouseService.areMouseEventsActive)return this.viewport.handleTouchStart(F),this.cancel(F)}),{passive:!0})),this.register((0,u.addDisposableDomListener)(R,"touchmove",(F=>{if(!this.coreMouseService.areMouseEventsActive)return this.viewport.handleTouchMove(F)?void 0:this.cancel(F)}),{passive:!1}))}refresh(S,R){var B;(B=this._renderService)===null||B===void 0||B.refreshRows(S,R)}updateCursorStyle(S){var R;!((R=this._selectionService)===null||R===void 0)&&R.shouldColumnSelect(S)?this.element.classList.add("column-select"):this.element.classList.remove("column-select")}_showCursor(){this.coreService.isCursorInitialized||(this.coreService.isCursorInitialized=!0,this.refresh(this.buffer.y,this.buffer.y))}scrollLines(S,R,B=0){var A;B===1?(super.scrollLines(S,R,B),this.refresh(0,this.rows-1)):(A=this.viewport)===null||A===void 0||A.scrollLines(S)}paste(S){(0,l.paste)(S,this.textarea,this.coreService,this.optionsService)}attachCustomKeyEventHandler(S){this._customKeyEventHandler=S}registerLinkProvider(S){return this.linkifier2.registerLinkProvider(S)}registerCharacterJoiner(S){if(!this._characterJoinerService)throw new Error("Terminal must be opened first");let R=this._characterJoinerService.register(S);return this.refresh(0,this.rows-1),R}deregisterCharacterJoiner(S){if(!this._characterJoinerService)throw new Error("Terminal must be opened first");this._characterJoinerService.deregister(S)&&this.refresh(0,this.rows-1)}get markers(){return this.buffer.markers}registerMarker(S){return this.buffer.addMarker(this.buffer.ybase+this.buffer.y+S)}registerDecoration(S){return this._decorationService.registerDecoration(S)}hasSelection(){return!!this._selectionService&&this._selectionService.hasSelection}select(S,R,B){this._selectionService.setSelection(S,R,B)}getSelection(){return this._selectionService?this._selectionService.selectionText:""}getSelectionPosition(){if(this._selectionService&&this._selectionService.hasSelection)return{start:{x:this._selectionService.selectionStart[0],y:this._selectionService.selectionStart[1]},end:{x:this._selectionService.selectionEnd[0],y:this._selectionService.selectionEnd[1]}}}clearSelection(){var S;(S=this._selectionService)===null||S===void 0||S.clearSelection()}selectAll(){var S;(S=this._selectionService)===null||S===void 0||S.selectAll()}selectLines(S,R){var B;(B=this._selectionService)===null||B===void 0||B.selectLines(S,R)}_keyDown(S){if(this._keyDownHandled=!1,this._keyDownSeen=!0,this._customKeyEventHandler&&this._customKeyEventHandler(S)===!1)return!1;let R=this.browser.isMac&&this.options.macOptionIsMeta&&S.altKey;if(!R&&!this._compositionHelper.keydown(S))return this.options.scrollOnUserInput&&this.buffer.ybase!==this.buffer.ydisp&&this.scrollToBottom(),!1;R||S.key!=="Dead"&&S.key!=="AltGraph"||(this._unprocessedDeadKey=!0);let B=(0,C.evaluateKeyboardEvent)(S,this.coreService.decPrivateModes.applicationCursorKeys,this.browser.isMac,this.options.macOptionIsMeta);if(this.updateCursorStyle(S),B.type===3||B.type===2){let A=this.rows-1;return this.scrollLines(B.type===2?-A:A),this.cancel(S,!0)}return B.type===1&&this.selectAll(),!!this._isThirdLevelShift(this.browser,S)||(B.cancel&&this.cancel(S,!0),!B.key||!!(S.key&&!S.ctrlKey&&!S.altKey&&!S.metaKey&&S.key.length===1&&S.key.charCodeAt(0)>=65&&S.key.charCodeAt(0)<=90)||(this._unprocessedDeadKey?(this._unprocessedDeadKey=!1,!0):(B.key!==M.C0.ETX&&B.key!==M.C0.CR||(this.textarea.value=""),this._onKey.fire({key:B.key,domEvent:S}),this._showCursor(),this.coreService.triggerDataEvent(B.key,!0),!this.optionsService.rawOptions.screenReaderMode||S.altKey||S.ctrlKey?this.cancel(S,!0):void(this._keyDownHandled=!0))))}_isThirdLevelShift(S,R){let B=S.isMac&&!this.options.macOptionIsMeta&&R.altKey&&!R.ctrlKey&&!R.metaKey||S.isWindows&&R.altKey&&R.ctrlKey&&!R.metaKey||S.isWindows&&R.getModifierState("AltGraph");return R.type==="keypress"?B:B&&(!R.keyCode||R.keyCode>47)}_keyUp(S){this._keyDownSeen=!1,this._customKeyEventHandler&&this._customKeyEventHandler(S)===!1||((function(R){return R.keyCode===16||R.keyCode===17||R.keyCode===18})(S)||this.focus(),this.updateCursorStyle(S),this._keyPressHandled=!1)}_keyPress(S){let R;if(this._keyPressHandled=!1,this._keyDownHandled||this._customKeyEventHandler&&this._customKeyEventHandler(S)===!1)return!1;if(this.cancel(S),S.charCode)R=S.charCode;else if(S.which===null||S.which===void 0)R=S.keyCode;else{if(S.which===0||S.charCode===0)return!1;R=S.which}return!(!R||(S.altKey||S.ctrlKey||S.metaKey)&&!this._isThirdLevelShift(this.browser,S)||(R=String.fromCharCode(R),this._onKey.fire({key:R,domEvent:S}),this._showCursor(),this.coreService.triggerDataEvent(R,!0),this._keyPressHandled=!0,this._unprocessedDeadKey=!1,0))}_inputEvent(S){if(S.data&&S.inputType==="insertText"&&(!S.composed||!this._keyDownSeen)&&!this.optionsService.rawOptions.screenReaderMode){if(this._keyPressHandled)return!1;this._unprocessedDeadKey=!1;let R=S.data;return this.coreService.triggerDataEvent(R,!0),this.cancel(S),!0}return!1}resize(S,R){S!==this.cols||R!==this.rows?super.resize(S,R):this._charSizeService&&!this._charSizeService.hasValidSize&&this._charSizeService.measure()}_afterResize(S,R){var B,A;(B=this._charSizeService)===null||B===void 0||B.measure(),(A=this.viewport)===null||A===void 0||A.syncScrollArea(!0)}clear(){var S;if(this.buffer.ybase!==0||this.buffer.y!==0){this.buffer.clearAllMarkers(),this.buffer.lines.set(0,this.buffer.lines.get(this.buffer.ybase+this.buffer.y)),this.buffer.lines.length=1,this.buffer.ydisp=0,this.buffer.ybase=0,this.buffer.y=0;for(let R=1;R<this.rows;R++)this.buffer.lines.push(this.buffer.getBlankLine(P.DEFAULT_ATTR_DATA));this._onScroll.fire({position:this.buffer.ydisp,source:0}),(S=this.viewport)===null||S===void 0||S.reset(),this.refresh(0,this.rows-1)}}reset(){var S,R;this.options.rows=this.rows,this.options.cols=this.cols;let B=this._customKeyEventHandler;this._setup(),super.reset(),(S=this._selectionService)===null||S===void 0||S.reset(),this._decorationService.reset(),(R=this.viewport)===null||R===void 0||R.reset(),this._customKeyEventHandler=B,this.refresh(0,this.rows-1)}clearTextureAtlas(){var S;(S=this._renderService)===null||S===void 0||S.clearTextureAtlas()}_reportFocus(){var S;!((S=this.element)===null||S===void 0)&&S.classList.contains("focus")?this.coreService.triggerDataEvent(M.C0.ESC+"[I"):this.coreService.triggerDataEvent(M.C0.ESC+"[O")}_reportWindowsOptions(S){if(this._renderService)switch(S){case I.WindowsOptionsReportType.GET_WIN_SIZE_PIXELS:let R=this._renderService.dimensions.css.canvas.width.toFixed(0),B=this._renderService.dimensions.css.canvas.height.toFixed(0);this.coreService.triggerDataEvent(`${M.C0.ESC}[4;${B};${R}t`);break;case I.WindowsOptionsReportType.GET_CELL_SIZE_PIXELS:let A=this._renderService.dimensions.css.cell.width.toFixed(0),N=this._renderService.dimensions.css.cell.height.toFixed(0);this.coreService.triggerDataEvent(`${M.C0.ESC}[6;${N};${A}t`)}}cancel(S,R){if(this.options.cancelEvents||R)return S.preventDefault(),S.stopPropagation(),!1}}r.Terminal=W},9924:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.TimeBasedDebouncer=void 0,r.TimeBasedDebouncer=class{constructor(a,l=1e3){this._renderCallback=a,this._debounceThresholdMS=l,this._lastRefreshMs=0,this._additionalRefreshRequested=!1}dispose(){this._refreshTimeoutID&&clearTimeout(this._refreshTimeoutID)}refresh(a,l,u){this._rowCount=u,a=a!==void 0?a:0,l=l!==void 0?l:this._rowCount-1,this._rowStart=this._rowStart!==void 0?Math.min(this._rowStart,a):a,this._rowEnd=this._rowEnd!==void 0?Math.max(this._rowEnd,l):l;let n=Date.now();if(n-this._lastRefreshMs>=this._debounceThresholdMS)this._lastRefreshMs=n,this._innerRefresh();else if(!this._additionalRefreshRequested){let d=n-this._lastRefreshMs,f=this._debounceThresholdMS-d;this._additionalRefreshRequested=!0,this._refreshTimeoutID=window.setTimeout((()=>{this._lastRefreshMs=Date.now(),this._innerRefresh(),this._additionalRefreshRequested=!1,this._refreshTimeoutID=void 0}),f)}}_innerRefresh(){if(this._rowStart===void 0||this._rowEnd===void 0||this._rowCount===void 0)return;let a=Math.max(this._rowStart,0),l=Math.min(this._rowEnd,this._rowCount-1);this._rowStart=void 0,this._rowEnd=void 0,this._renderCallback(a,l)}}},1680:function(O,r,a){var l=this&&this.__decorate||function(s,t,i,o){var c,v=arguments.length,m=v<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")m=Reflect.decorate(s,t,i,o);else for(var h=s.length-1;h>=0;h--)(c=s[h])&&(m=(v<3?c(m):v>3?c(t,i,m):c(t,i))||m);return v>3&&m&&Object.defineProperty(t,i,m),m},u=this&&this.__param||function(s,t){return function(i,o){t(i,o,s)}};Object.defineProperty(r,"__esModule",{value:!0}),r.Viewport=void 0;let n=a(3656),d=a(4725),f=a(8460),p=a(844),_=a(2585),e=r.Viewport=class extends p.Disposable{constructor(s,t,i,o,c,v,m,h){super(),this._viewportElement=s,this._scrollArea=t,this._bufferService=i,this._optionsService=o,this._charSizeService=c,this._renderService=v,this._coreBrowserService=m,this.scrollBarWidth=0,this._currentRowHeight=0,this._currentDeviceCellHeight=0,this._lastRecordedBufferLength=0,this._lastRecordedViewportHeight=0,this._lastRecordedBufferHeight=0,this._lastTouchY=0,this._lastScrollTop=0,this._wheelPartialScroll=0,this._refreshAnimationFrame=null,this._ignoreNextScrollEvent=!1,this._smoothScrollState={startTime:0,origin:-1,target:-1},this._onRequestScrollLines=this.register(new f.EventEmitter),this.onRequestScrollLines=this._onRequestScrollLines.event,this.scrollBarWidth=this._viewportElement.offsetWidth-this._scrollArea.offsetWidth||15,this.register((0,n.addDisposableDomListener)(this._viewportElement,"scroll",this._handleScroll.bind(this))),this._activeBuffer=this._bufferService.buffer,this.register(this._bufferService.buffers.onBufferActivate((g=>this._activeBuffer=g.activeBuffer))),this._renderDimensions=this._renderService.dimensions,this.register(this._renderService.onDimensionsChange((g=>this._renderDimensions=g))),this._handleThemeChange(h.colors),this.register(h.onChangeColors((g=>this._handleThemeChange(g)))),this.register(this._optionsService.onSpecificOptionChange("scrollback",(()=>this.syncScrollArea()))),setTimeout((()=>this.syncScrollArea()))}_handleThemeChange(s){this._viewportElement.style.backgroundColor=s.background.css}reset(){this._currentRowHeight=0,this._currentDeviceCellHeight=0,this._lastRecordedBufferLength=0,this._lastRecordedViewportHeight=0,this._lastRecordedBufferHeight=0,this._lastTouchY=0,this._lastScrollTop=0,this._coreBrowserService.window.requestAnimationFrame((()=>this.syncScrollArea()))}_refresh(s){if(s)return this._innerRefresh(),void(this._refreshAnimationFrame!==null&&this._coreBrowserService.window.cancelAnimationFrame(this._refreshAnimationFrame));this._refreshAnimationFrame===null&&(this._refreshAnimationFrame=this._coreBrowserService.window.requestAnimationFrame((()=>this._innerRefresh())))}_innerRefresh(){if(this._charSizeService.height>0){this._currentRowHeight=this._renderService.dimensions.device.cell.height/this._coreBrowserService.dpr,this._currentDeviceCellHeight=this._renderService.dimensions.device.cell.height,this._lastRecordedViewportHeight=this._viewportElement.offsetHeight;let t=Math.round(this._currentRowHeight*this._lastRecordedBufferLength)+(this._lastRecordedViewportHeight-this._renderService.dimensions.css.canvas.height);this._lastRecordedBufferHeight!==t&&(this._lastRecordedBufferHeight=t,this._scrollArea.style.height=this._lastRecordedBufferHeight+"px")}let s=this._bufferService.buffer.ydisp*this._currentRowHeight;this._viewportElement.scrollTop!==s&&(this._ignoreNextScrollEvent=!0,this._viewportElement.scrollTop=s),this._refreshAnimationFrame=null}syncScrollArea(s=!1){if(this._lastRecordedBufferLength!==this._bufferService.buffer.lines.length)return this._lastRecordedBufferLength=this._bufferService.buffer.lines.length,void this._refresh(s);this._lastRecordedViewportHeight===this._renderService.dimensions.css.canvas.height&&this._lastScrollTop===this._activeBuffer.ydisp*this._currentRowHeight&&this._renderDimensions.device.cell.height===this._currentDeviceCellHeight||this._refresh(s)}_handleScroll(s){if(this._lastScrollTop=this._viewportElement.scrollTop,!this._viewportElement.offsetParent)return;if(this._ignoreNextScrollEvent)return this._ignoreNextScrollEvent=!1,void this._onRequestScrollLines.fire({amount:0,suppressScrollEvent:!0});let t=Math.round(this._lastScrollTop/this._currentRowHeight)-this._bufferService.buffer.ydisp;this._onRequestScrollLines.fire({amount:t,suppressScrollEvent:!0})}_smoothScroll(){if(this._isDisposed||this._smoothScrollState.origin===-1||this._smoothScrollState.target===-1)return;let s=this._smoothScrollPercent();this._viewportElement.scrollTop=this._smoothScrollState.origin+Math.round(s*(this._smoothScrollState.target-this._smoothScrollState.origin)),s<1?this._coreBrowserService.window.requestAnimationFrame((()=>this._smoothScroll())):this._clearSmoothScrollState()}_smoothScrollPercent(){return this._optionsService.rawOptions.smoothScrollDuration&&this._smoothScrollState.startTime?Math.max(Math.min((Date.now()-this._smoothScrollState.startTime)/this._optionsService.rawOptions.smoothScrollDuration,1),0):1}_clearSmoothScrollState(){this._smoothScrollState.startTime=0,this._smoothScrollState.origin=-1,this._smoothScrollState.target=-1}_bubbleScroll(s,t){let i=this._viewportElement.scrollTop+this._lastRecordedViewportHeight;return!(t<0&&this._viewportElement.scrollTop!==0||t>0&&i<this._lastRecordedBufferHeight)||(s.cancelable&&s.preventDefault(),!1)}handleWheel(s){let t=this._getPixelsScrolled(s);return t!==0&&(this._optionsService.rawOptions.smoothScrollDuration?(this._smoothScrollState.startTime=Date.now(),this._smoothScrollPercent()<1?(this._smoothScrollState.origin=this._viewportElement.scrollTop,this._smoothScrollState.target===-1?this._smoothScrollState.target=this._viewportElement.scrollTop+t:this._smoothScrollState.target+=t,this._smoothScrollState.target=Math.max(Math.min(this._smoothScrollState.target,this._viewportElement.scrollHeight),0),this._smoothScroll()):this._clearSmoothScrollState()):this._viewportElement.scrollTop+=t,this._bubbleScroll(s,t))}scrollLines(s){if(s!==0)if(this._optionsService.rawOptions.smoothScrollDuration){let t=s*this._currentRowHeight;this._smoothScrollState.startTime=Date.now(),this._smoothScrollPercent()<1?(this._smoothScrollState.origin=this._viewportElement.scrollTop,this._smoothScrollState.target=this._smoothScrollState.origin+t,this._smoothScrollState.target=Math.max(Math.min(this._smoothScrollState.target,this._viewportElement.scrollHeight),0),this._smoothScroll()):this._clearSmoothScrollState()}else this._onRequestScrollLines.fire({amount:s,suppressScrollEvent:!1})}_getPixelsScrolled(s){if(s.deltaY===0||s.shiftKey)return 0;let t=this._applyScrollModifier(s.deltaY,s);return s.deltaMode===WheelEvent.DOM_DELTA_LINE?t*=this._currentRowHeight:s.deltaMode===WheelEvent.DOM_DELTA_PAGE&&(t*=this._currentRowHeight*this._bufferService.rows),t}getBufferElements(s,t){var i;let o,c="",v=[],m=t??this._bufferService.buffer.lines.length,h=this._bufferService.buffer.lines;for(let g=s;g<m;g++){let b=h.get(g);if(!b)continue;let L=(i=h.get(g+1))===null||i===void 0?void 0:i.isWrapped;if(c+=b.translateToString(!L),!L||g===h.length-1){let y=document.createElement("div");y.textContent=c,v.push(y),c.length>0&&(o=y),c=""}}return{bufferElements:v,cursorElement:o}}getLinesScrolled(s){if(s.deltaY===0||s.shiftKey)return 0;let t=this._applyScrollModifier(s.deltaY,s);return s.deltaMode===WheelEvent.DOM_DELTA_PIXEL?(t/=this._currentRowHeight+0,this._wheelPartialScroll+=t,t=Math.floor(Math.abs(this._wheelPartialScroll))*(this._wheelPartialScroll>0?1:-1),this._wheelPartialScroll%=1):s.deltaMode===WheelEvent.DOM_DELTA_PAGE&&(t*=this._bufferService.rows),t}_applyScrollModifier(s,t){let i=this._optionsService.rawOptions.fastScrollModifier;return i==="alt"&&t.altKey||i==="ctrl"&&t.ctrlKey||i==="shift"&&t.shiftKey?s*this._optionsService.rawOptions.fastScrollSensitivity*this._optionsService.rawOptions.scrollSensitivity:s*this._optionsService.rawOptions.scrollSensitivity}handleTouchStart(s){this._lastTouchY=s.touches[0].pageY}handleTouchMove(s){let t=this._lastTouchY-s.touches[0].pageY;return this._lastTouchY=s.touches[0].pageY,t!==0&&(this._viewportElement.scrollTop+=t,this._bubbleScroll(s,t))}};r.Viewport=e=l([u(2,_.IBufferService),u(3,_.IOptionsService),u(4,d.ICharSizeService),u(5,d.IRenderService),u(6,d.ICoreBrowserService),u(7,d.IThemeService)],e)},3107:function(O,r,a){var l=this&&this.__decorate||function(e,s,t,i){var o,c=arguments.length,v=c<3?s:i===null?i=Object.getOwnPropertyDescriptor(s,t):i;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")v=Reflect.decorate(e,s,t,i);else for(var m=e.length-1;m>=0;m--)(o=e[m])&&(v=(c<3?o(v):c>3?o(s,t,v):o(s,t))||v);return c>3&&v&&Object.defineProperty(s,t,v),v},u=this&&this.__param||function(e,s){return function(t,i){s(t,i,e)}};Object.defineProperty(r,"__esModule",{value:!0}),r.BufferDecorationRenderer=void 0;let n=a(3656),d=a(4725),f=a(844),p=a(2585),_=r.BufferDecorationRenderer=class extends f.Disposable{constructor(e,s,t,i){super(),this._screenElement=e,this._bufferService=s,this._decorationService=t,this._renderService=i,this._decorationElements=new Map,this._altBufferIsActive=!1,this._dimensionsChanged=!1,this._container=document.createElement("div"),this._container.classList.add("xterm-decoration-container"),this._screenElement.appendChild(this._container),this.register(this._renderService.onRenderedViewportChange((()=>this._doRefreshDecorations()))),this.register(this._renderService.onDimensionsChange((()=>{this._dimensionsChanged=!0,this._queueRefresh()}))),this.register((0,n.addDisposableDomListener)(window,"resize",(()=>this._queueRefresh()))),this.register(this._bufferService.buffers.onBufferActivate((()=>{this._altBufferIsActive=this._bufferService.buffer===this._bufferService.buffers.alt}))),this.register(this._decorationService.onDecorationRegistered((()=>this._queueRefresh()))),this.register(this._decorationService.onDecorationRemoved((o=>this._removeDecoration(o)))),this.register((0,f.toDisposable)((()=>{this._container.remove(),this._decorationElements.clear()})))}_queueRefresh(){this._animationFrame===void 0&&(this._animationFrame=this._renderService.addRefreshCallback((()=>{this._doRefreshDecorations(),this._animationFrame=void 0})))}_doRefreshDecorations(){for(let e of this._decorationService.decorations)this._renderDecoration(e);this._dimensionsChanged=!1}_renderDecoration(e){this._refreshStyle(e),this._dimensionsChanged&&this._refreshXPosition(e)}_createElement(e){var s,t;let i=document.createElement("div");i.classList.add("xterm-decoration"),i.classList.toggle("xterm-decoration-top-layer",((s=e?.options)===null||s===void 0?void 0:s.layer)==="top"),i.style.width=`${Math.round((e.options.width||1)*this._renderService.dimensions.css.cell.width)}px`,i.style.height=(e.options.height||1)*this._renderService.dimensions.css.cell.height+"px",i.style.top=(e.marker.line-this._bufferService.buffers.active.ydisp)*this._renderService.dimensions.css.cell.height+"px",i.style.lineHeight=`${this._renderService.dimensions.css.cell.height}px`;let o=(t=e.options.x)!==null&&t!==void 0?t:0;return o&&o>this._bufferService.cols&&(i.style.display="none"),this._refreshXPosition(e,i),i}_refreshStyle(e){let s=e.marker.line-this._bufferService.buffers.active.ydisp;if(s<0||s>=this._bufferService.rows)e.element&&(e.element.style.display="none",e.onRenderEmitter.fire(e.element));else{let t=this._decorationElements.get(e);t||(t=this._createElement(e),e.element=t,this._decorationElements.set(e,t),this._container.appendChild(t),e.onDispose((()=>{this._decorationElements.delete(e),t.remove()}))),t.style.top=s*this._renderService.dimensions.css.cell.height+"px",t.style.display=this._altBufferIsActive?"none":"block",e.onRenderEmitter.fire(t)}}_refreshXPosition(e,s=e.element){var t;if(!s)return;let i=(t=e.options.x)!==null&&t!==void 0?t:0;(e.options.anchor||"left")==="right"?s.style.right=i?i*this._renderService.dimensions.css.cell.width+"px":"":s.style.left=i?i*this._renderService.dimensions.css.cell.width+"px":""}_removeDecoration(e){var s;(s=this._decorationElements.get(e))===null||s===void 0||s.remove(),this._decorationElements.delete(e),e.dispose()}};r.BufferDecorationRenderer=_=l([u(1,p.IBufferService),u(2,p.IDecorationService),u(3,d.IRenderService)],_)},5871:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.ColorZoneStore=void 0,r.ColorZoneStore=class{constructor(){this._zones=[],this._zonePool=[],this._zonePoolIndex=0,this._linePadding={full:0,left:0,center:0,right:0}}get zones(){return this._zonePool.length=Math.min(this._zonePool.length,this._zones.length),this._zones}clear(){this._zones.length=0,this._zonePoolIndex=0}addDecoration(a){if(a.options.overviewRulerOptions){for(let l of this._zones)if(l.color===a.options.overviewRulerOptions.color&&l.position===a.options.overviewRulerOptions.position){if(this._lineIntersectsZone(l,a.marker.line))return;if(this._lineAdjacentToZone(l,a.marker.line,a.options.overviewRulerOptions.position))return void this._addLineToZone(l,a.marker.line)}if(this._zonePoolIndex<this._zonePool.length)return this._zonePool[this._zonePoolIndex].color=a.options.overviewRulerOptions.color,this._zonePool[this._zonePoolIndex].position=a.options.overviewRulerOptions.position,this._zonePool[this._zonePoolIndex].startBufferLine=a.marker.line,this._zonePool[this._zonePoolIndex].endBufferLine=a.marker.line,void this._zones.push(this._zonePool[this._zonePoolIndex++]);this._zones.push({color:a.options.overviewRulerOptions.color,position:a.options.overviewRulerOptions.position,startBufferLine:a.marker.line,endBufferLine:a.marker.line}),this._zonePool.push(this._zones[this._zones.length-1]),this._zonePoolIndex++}}setPadding(a){this._linePadding=a}_lineIntersectsZone(a,l){return l>=a.startBufferLine&&l<=a.endBufferLine}_lineAdjacentToZone(a,l,u){return l>=a.startBufferLine-this._linePadding[u||"full"]&&l<=a.endBufferLine+this._linePadding[u||"full"]}_addLineToZone(a,l){a.startBufferLine=Math.min(a.startBufferLine,l),a.endBufferLine=Math.max(a.endBufferLine,l)}}},5744:function(O,r,a){var l=this&&this.__decorate||function(o,c,v,m){var h,g=arguments.length,b=g<3?c:m===null?m=Object.getOwnPropertyDescriptor(c,v):m;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")b=Reflect.decorate(o,c,v,m);else for(var L=o.length-1;L>=0;L--)(h=o[L])&&(b=(g<3?h(b):g>3?h(c,v,b):h(c,v))||b);return g>3&&b&&Object.defineProperty(c,v,b),b},u=this&&this.__param||function(o,c){return function(v,m){c(v,m,o)}};Object.defineProperty(r,"__esModule",{value:!0}),r.OverviewRulerRenderer=void 0;let n=a(5871),d=a(3656),f=a(4725),p=a(844),_=a(2585),e={full:0,left:0,center:0,right:0},s={full:0,left:0,center:0,right:0},t={full:0,left:0,center:0,right:0},i=r.OverviewRulerRenderer=class extends p.Disposable{get _width(){return this._optionsService.options.overviewRulerWidth||0}constructor(o,c,v,m,h,g,b){var L;super(),this._viewportElement=o,this._screenElement=c,this._bufferService=v,this._decorationService=m,this._renderService=h,this._optionsService=g,this._coreBrowseService=b,this._colorZoneStore=new n.ColorZoneStore,this._shouldUpdateDimensions=!0,this._shouldUpdateAnchor=!0,this._lastKnownBufferLength=0,this._canvas=document.createElement("canvas"),this._canvas.classList.add("xterm-decoration-overview-ruler"),this._refreshCanvasDimensions(),(L=this._viewportElement.parentElement)===null||L===void 0||L.insertBefore(this._canvas,this._viewportElement);let y=this._canvas.getContext("2d");if(!y)throw new Error("Ctx cannot be null");this._ctx=y,this._registerDecorationListeners(),this._registerBufferChangeListeners(),this._registerDimensionChangeListeners(),this.register((0,p.toDisposable)((()=>{var k;(k=this._canvas)===null||k===void 0||k.remove()})))}_registerDecorationListeners(){this.register(this._decorationService.onDecorationRegistered((()=>this._queueRefresh(void 0,!0)))),this.register(this._decorationService.onDecorationRemoved((()=>this._queueRefresh(void 0,!0))))}_registerBufferChangeListeners(){this.register(this._renderService.onRenderedViewportChange((()=>this._queueRefresh()))),this.register(this._bufferService.buffers.onBufferActivate((()=>{this._canvas.style.display=this._bufferService.buffer===this._bufferService.buffers.alt?"none":"block"}))),this.register(this._bufferService.onScroll((()=>{this._lastKnownBufferLength!==this._bufferService.buffers.normal.lines.length&&(this._refreshDrawHeightConstants(),this._refreshColorZonePadding())})))}_registerDimensionChangeListeners(){this.register(this._renderService.onRender((()=>{this._containerHeight&&this._containerHeight===this._screenElement.clientHeight||(this._queueRefresh(!0),this._containerHeight=this._screenElement.clientHeight)}))),this.register(this._optionsService.onSpecificOptionChange("overviewRulerWidth",(()=>this._queueRefresh(!0)))),this.register((0,d.addDisposableDomListener)(this._coreBrowseService.window,"resize",(()=>this._queueRefresh(!0)))),this._queueRefresh(!0)}_refreshDrawConstants(){let o=Math.floor(this._canvas.width/3),c=Math.ceil(this._canvas.width/3);s.full=this._canvas.width,s.left=o,s.center=c,s.right=o,this._refreshDrawHeightConstants(),t.full=0,t.left=0,t.center=s.left,t.right=s.left+s.center}_refreshDrawHeightConstants(){e.full=Math.round(2*this._coreBrowseService.dpr);let o=this._canvas.height/this._bufferService.buffer.lines.length,c=Math.round(Math.max(Math.min(o,12),6)*this._coreBrowseService.dpr);e.left=c,e.center=c,e.right=c}_refreshColorZonePadding(){this._colorZoneStore.setPadding({full:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*e.full),left:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*e.left),center:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*e.center),right:Math.floor(this._bufferService.buffers.active.lines.length/(this._canvas.height-1)*e.right)}),this._lastKnownBufferLength=this._bufferService.buffers.normal.lines.length}_refreshCanvasDimensions(){this._canvas.style.width=`${this._width}px`,this._canvas.width=Math.round(this._width*this._coreBrowseService.dpr),this._canvas.style.height=`${this._screenElement.clientHeight}px`,this._canvas.height=Math.round(this._screenElement.clientHeight*this._coreBrowseService.dpr),this._refreshDrawConstants(),this._refreshColorZonePadding()}_refreshDecorations(){this._shouldUpdateDimensions&&this._refreshCanvasDimensions(),this._ctx.clearRect(0,0,this._canvas.width,this._canvas.height),this._colorZoneStore.clear();for(let c of this._decorationService.decorations)this._colorZoneStore.addDecoration(c);this._ctx.lineWidth=1;let o=this._colorZoneStore.zones;for(let c of o)c.position!=="full"&&this._renderColorZone(c);for(let c of o)c.position==="full"&&this._renderColorZone(c);this._shouldUpdateDimensions=!1,this._shouldUpdateAnchor=!1}_renderColorZone(o){this._ctx.fillStyle=o.color,this._ctx.fillRect(t[o.position||"full"],Math.round((this._canvas.height-1)*(o.startBufferLine/this._bufferService.buffers.active.lines.length)-e[o.position||"full"]/2),s[o.position||"full"],Math.round((this._canvas.height-1)*((o.endBufferLine-o.startBufferLine)/this._bufferService.buffers.active.lines.length)+e[o.position||"full"]))}_queueRefresh(o,c){this._shouldUpdateDimensions=o||this._shouldUpdateDimensions,this._shouldUpdateAnchor=c||this._shouldUpdateAnchor,this._animationFrame===void 0&&(this._animationFrame=this._coreBrowseService.window.requestAnimationFrame((()=>{this._refreshDecorations(),this._animationFrame=void 0})))}};r.OverviewRulerRenderer=i=l([u(2,_.IBufferService),u(3,_.IDecorationService),u(4,f.IRenderService),u(5,_.IOptionsService),u(6,f.ICoreBrowserService)],i)},2950:function(O,r,a){var l=this&&this.__decorate||function(_,e,s,t){var i,o=arguments.length,c=o<3?e:t===null?t=Object.getOwnPropertyDescriptor(e,s):t;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")c=Reflect.decorate(_,e,s,t);else for(var v=_.length-1;v>=0;v--)(i=_[v])&&(c=(o<3?i(c):o>3?i(e,s,c):i(e,s))||c);return o>3&&c&&Object.defineProperty(e,s,c),c},u=this&&this.__param||function(_,e){return function(s,t){e(s,t,_)}};Object.defineProperty(r,"__esModule",{value:!0}),r.CompositionHelper=void 0;let n=a(4725),d=a(2585),f=a(2584),p=r.CompositionHelper=class{get isComposing(){return this._isComposing}constructor(_,e,s,t,i,o){this._textarea=_,this._compositionView=e,this._bufferService=s,this._optionsService=t,this._coreService=i,this._renderService=o,this._isComposing=!1,this._isSendingComposition=!1,this._compositionPosition={start:0,end:0},this._dataAlreadySent=""}compositionstart(){this._isComposing=!0,this._compositionPosition.start=this._textarea.value.length,this._compositionView.textContent="",this._dataAlreadySent="",this._compositionView.classList.add("active")}compositionupdate(_){this._compositionView.textContent=_.data,this.updateCompositionElements(),setTimeout((()=>{this._compositionPosition.end=this._textarea.value.length}),0)}compositionend(){this._finalizeComposition(!0)}keydown(_){if(this._isComposing||this._isSendingComposition){if(_.keyCode===229||_.keyCode===16||_.keyCode===17||_.keyCode===18)return!1;this._finalizeComposition(!1)}return _.keyCode!==229||(this._handleAnyTextareaChanges(),!1)}_finalizeComposition(_){if(this._compositionView.classList.remove("active"),this._isComposing=!1,_){let e={start:this._compositionPosition.start,end:this._compositionPosition.end};this._isSendingComposition=!0,setTimeout((()=>{if(this._isSendingComposition){let s;this._isSendingComposition=!1,e.start+=this._dataAlreadySent.length,s=this._isComposing?this._textarea.value.substring(e.start,e.end):this._textarea.value.substring(e.start),s.length>0&&this._coreService.triggerDataEvent(s,!0)}}),0)}else{this._isSendingComposition=!1;let e=this._textarea.value.substring(this._compositionPosition.start,this._compositionPosition.end);this._coreService.triggerDataEvent(e,!0)}}_handleAnyTextareaChanges(){let _=this._textarea.value;setTimeout((()=>{if(!this._isComposing){let e=this._textarea.value,s=e.replace(_,"");this._dataAlreadySent=s,e.length>_.length?this._coreService.triggerDataEvent(s,!0):e.length<_.length?this._coreService.triggerDataEvent(`${f.C0.DEL}`,!0):e.length===_.length&&e!==_&&this._coreService.triggerDataEvent(e,!0)}}),0)}updateCompositionElements(_){if(this._isComposing){if(this._bufferService.buffer.isCursorInViewport){let e=Math.min(this._bufferService.buffer.x,this._bufferService.cols-1),s=this._renderService.dimensions.css.cell.height,t=this._bufferService.buffer.y*this._renderService.dimensions.css.cell.height,i=e*this._renderService.dimensions.css.cell.width;this._compositionView.style.left=i+"px",this._compositionView.style.top=t+"px",this._compositionView.style.height=s+"px",this._compositionView.style.lineHeight=s+"px",this._compositionView.style.fontFamily=this._optionsService.rawOptions.fontFamily,this._compositionView.style.fontSize=this._optionsService.rawOptions.fontSize+"px";let o=this._compositionView.getBoundingClientRect();this._textarea.style.left=i+"px",this._textarea.style.top=t+"px",this._textarea.style.width=Math.max(o.width,1)+"px",this._textarea.style.height=Math.max(o.height,1)+"px",this._textarea.style.lineHeight=o.height+"px"}_||setTimeout((()=>this.updateCompositionElements(!0)),0)}}};r.CompositionHelper=p=l([u(2,d.IBufferService),u(3,d.IOptionsService),u(4,d.ICoreService),u(5,n.IRenderService)],p)},9806:(O,r)=>{function a(l,u,n){let d=n.getBoundingClientRect(),f=l.getComputedStyle(n),p=parseInt(f.getPropertyValue("padding-left")),_=parseInt(f.getPropertyValue("padding-top"));return[u.clientX-d.left-p,u.clientY-d.top-_]}Object.defineProperty(r,"__esModule",{value:!0}),r.getCoords=r.getCoordsRelativeToElement=void 0,r.getCoordsRelativeToElement=a,r.getCoords=function(l,u,n,d,f,p,_,e,s){if(!p)return;let t=a(l,u,n);return t?(t[0]=Math.ceil((t[0]+(s?_/2:0))/_),t[1]=Math.ceil(t[1]/e),t[0]=Math.min(Math.max(t[0],1),d+(s?1:0)),t[1]=Math.min(Math.max(t[1],1),f),t):void 0}},9504:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.moveToCellSequence=void 0;let l=a(2584);function u(e,s,t,i){let o=e-n(e,t),c=s-n(s,t),v=Math.abs(o-c)-(function(m,h,g){let b=0,L=m-n(m,g),y=h-n(h,g);for(let k=0;k<Math.abs(L-y);k++){let x=d(m,h)==="A"?-1:1,T=g.buffer.lines.get(L+x*k);T?.isWrapped&&b++}return b})(e,s,t);return _(v,p(d(e,s),i))}function n(e,s){let t=0,i=s.buffer.lines.get(e),o=i?.isWrapped;for(;o&&e>=0&&e<s.rows;)t++,i=s.buffer.lines.get(--e),o=i?.isWrapped;return t}function d(e,s){return e>s?"A":"B"}function f(e,s,t,i,o,c){let v=e,m=s,h="";for(;v!==t||m!==i;)v+=o?1:-1,o&&v>c.cols-1?(h+=c.buffer.translateBufferLineToString(m,!1,e,v),v=0,e=0,m++):!o&&v<0&&(h+=c.buffer.translateBufferLineToString(m,!1,0,e+1),v=c.cols-1,e=v,m--);return h+c.buffer.translateBufferLineToString(m,!1,e,v)}function p(e,s){let t=s?"O":"[";return l.C0.ESC+t+e}function _(e,s){e=Math.floor(e);let t="";for(let i=0;i<e;i++)t+=s;return t}r.moveToCellSequence=function(e,s,t,i){let o=t.buffer.x,c=t.buffer.y;if(!t.buffer.hasScrollback)return(function(h,g,b,L,y,k){return u(g,L,y,k).length===0?"":_(f(h,g,h,g-n(g,y),!1,y).length,p("D",k))})(o,c,0,s,t,i)+u(c,s,t,i)+(function(h,g,b,L,y,k){let x;x=u(g,L,y,k).length>0?L-n(L,y):g;let T=L,P=(function(M,C,w,E,D,I){let H;return H=u(w,E,D,I).length>0?E-n(E,D):C,M<w&&H<=E||M>=w&&H<E?"C":"D"})(h,g,b,L,y,k);return _(f(h,x,b,T,P==="C",y).length,p(P,k))})(o,c,e,s,t,i);let v;if(c===s)return v=o>e?"D":"C",_(Math.abs(o-e),p(v,i));v=c>s?"D":"C";let m=Math.abs(c-s);return _((function(h,g){return g.cols-h})(c>s?e:o,t)+(m-1)*t.cols+1+((c>s?o:e)-1),p(v,i))}},1296:function(O,r,a){var l=this&&this.__decorate||function(y,k,x,T){var P,M=arguments.length,C=M<3?k:T===null?T=Object.getOwnPropertyDescriptor(k,x):T;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")C=Reflect.decorate(y,k,x,T);else for(var w=y.length-1;w>=0;w--)(P=y[w])&&(C=(M<3?P(C):M>3?P(k,x,C):P(k,x))||C);return M>3&&C&&Object.defineProperty(k,x,C),C},u=this&&this.__param||function(y,k){return function(x,T){k(x,T,y)}};Object.defineProperty(r,"__esModule",{value:!0}),r.DomRenderer=void 0;let n=a(3787),d=a(2550),f=a(2223),p=a(6171),_=a(4725),e=a(8055),s=a(8460),t=a(844),i=a(2585),o="xterm-dom-renderer-owner-",c="xterm-rows",v="xterm-fg-",m="xterm-bg-",h="xterm-focus",g="xterm-selection",b=1,L=r.DomRenderer=class extends t.Disposable{constructor(y,k,x,T,P,M,C,w,E,D){super(),this._element=y,this._screenElement=k,this._viewportElement=x,this._linkifier2=T,this._charSizeService=M,this._optionsService=C,this._bufferService=w,this._coreBrowserService=E,this._themeService=D,this._terminalClass=b++,this._rowElements=[],this.onRequestRedraw=this.register(new s.EventEmitter).event,this._rowContainer=document.createElement("div"),this._rowContainer.classList.add(c),this._rowContainer.style.lineHeight="normal",this._rowContainer.setAttribute("aria-hidden","true"),this._refreshRowElements(this._bufferService.cols,this._bufferService.rows),this._selectionContainer=document.createElement("div"),this._selectionContainer.classList.add(g),this._selectionContainer.setAttribute("aria-hidden","true"),this.dimensions=(0,p.createRenderDimensions)(),this._updateDimensions(),this.register(this._optionsService.onOptionChange((()=>this._handleOptionsChanged()))),this.register(this._themeService.onChangeColors((I=>this._injectCss(I)))),this._injectCss(this._themeService.colors),this._rowFactory=P.createInstance(n.DomRendererRowFactory,document),this._element.classList.add(o+this._terminalClass),this._screenElement.appendChild(this._rowContainer),this._screenElement.appendChild(this._selectionContainer),this.register(this._linkifier2.onShowLinkUnderline((I=>this._handleLinkHover(I)))),this.register(this._linkifier2.onHideLinkUnderline((I=>this._handleLinkLeave(I)))),this.register((0,t.toDisposable)((()=>{this._element.classList.remove(o+this._terminalClass),this._rowContainer.remove(),this._selectionContainer.remove(),this._widthCache.dispose(),this._themeStyleElement.remove(),this._dimensionsStyleElement.remove()}))),this._widthCache=new d.WidthCache(document),this._widthCache.setFont(this._optionsService.rawOptions.fontFamily,this._optionsService.rawOptions.fontSize,this._optionsService.rawOptions.fontWeight,this._optionsService.rawOptions.fontWeightBold),this._setDefaultSpacing()}_updateDimensions(){let y=this._coreBrowserService.dpr;this.dimensions.device.char.width=this._charSizeService.width*y,this.dimensions.device.char.height=Math.ceil(this._charSizeService.height*y),this.dimensions.device.cell.width=this.dimensions.device.char.width+Math.round(this._optionsService.rawOptions.letterSpacing),this.dimensions.device.cell.height=Math.floor(this.dimensions.device.char.height*this._optionsService.rawOptions.lineHeight),this.dimensions.device.char.left=0,this.dimensions.device.char.top=0,this.dimensions.device.canvas.width=this.dimensions.device.cell.width*this._bufferService.cols,this.dimensions.device.canvas.height=this.dimensions.device.cell.height*this._bufferService.rows,this.dimensions.css.canvas.width=Math.round(this.dimensions.device.canvas.width/y),this.dimensions.css.canvas.height=Math.round(this.dimensions.device.canvas.height/y),this.dimensions.css.cell.width=this.dimensions.css.canvas.width/this._bufferService.cols,this.dimensions.css.cell.height=this.dimensions.css.canvas.height/this._bufferService.rows;for(let x of this._rowElements)x.style.width=`${this.dimensions.css.canvas.width}px`,x.style.height=`${this.dimensions.css.cell.height}px`,x.style.lineHeight=`${this.dimensions.css.cell.height}px`,x.style.overflow="hidden";this._dimensionsStyleElement||(this._dimensionsStyleElement=document.createElement("style"),this._screenElement.appendChild(this._dimensionsStyleElement));let k=`${this._terminalSelector} .${c} span { display: inline-block; height: 100%; vertical-align: top;}`;this._dimensionsStyleElement.textContent=k,this._selectionContainer.style.height=this._viewportElement.style.height,this._screenElement.style.width=`${this.dimensions.css.canvas.width}px`,this._screenElement.style.height=`${this.dimensions.css.canvas.height}px`}_injectCss(y){this._themeStyleElement||(this._themeStyleElement=document.createElement("style"),this._screenElement.appendChild(this._themeStyleElement));let k=`${this._terminalSelector} .${c} { color: ${y.foreground.css}; font-family: ${this._optionsService.rawOptions.fontFamily}; font-size: ${this._optionsService.rawOptions.fontSize}px; font-kerning: none; white-space: pre}`;k+=`${this._terminalSelector} .${c} .xterm-dim { color: ${e.color.multiplyOpacity(y.foreground,.5).css};}`,k+=`${this._terminalSelector} span:not(.xterm-bold) { font-weight: ${this._optionsService.rawOptions.fontWeight};}${this._terminalSelector} span.xterm-bold { font-weight: ${this._optionsService.rawOptions.fontWeightBold};}${this._terminalSelector} span.xterm-italic { font-style: italic;}`,k+="@keyframes blink_box_shadow_"+this._terminalClass+" { 50% {  border-bottom-style: hidden; }}",k+="@keyframes blink_block_"+this._terminalClass+` { 0% {  background-color: ${y.cursor.css};  color: ${y.cursorAccent.css}; } 50% {  background-color: inherit;  color: ${y.cursor.css}; }}`,k+=`${this._terminalSelector} .${c}.${h} .xterm-cursor.xterm-cursor-blink:not(.xterm-cursor-block) { animation: blink_box_shadow_`+this._terminalClass+` 1s step-end infinite;}${this._terminalSelector} .${c}.${h} .xterm-cursor.xterm-cursor-blink.xterm-cursor-block { animation: blink_block_`+this._terminalClass+` 1s step-end infinite;}${this._terminalSelector} .${c} .xterm-cursor.xterm-cursor-block { background-color: ${y.cursor.css}; color: ${y.cursorAccent.css};}${this._terminalSelector} .${c} .xterm-cursor.xterm-cursor-outline { outline: 1px solid ${y.cursor.css}; outline-offset: -1px;}${this._terminalSelector} .${c} .xterm-cursor.xterm-cursor-bar { box-shadow: ${this._optionsService.rawOptions.cursorWidth}px 0 0 ${y.cursor.css} inset;}${this._terminalSelector} .${c} .xterm-cursor.xterm-cursor-underline { border-bottom: 1px ${y.cursor.css}; border-bottom-style: solid; height: calc(100% - 1px);}`,k+=`${this._terminalSelector} .${g} { position: absolute; top: 0; left: 0; z-index: 1; pointer-events: none;}${this._terminalSelector}.focus .${g} div { position: absolute; background-color: ${y.selectionBackgroundOpaque.css};}${this._terminalSelector} .${g} div { position: absolute; background-color: ${y.selectionInactiveBackgroundOpaque.css};}`;for(let[x,T]of y.ansi.entries())k+=`${this._terminalSelector} .${v}${x} { color: ${T.css}; }${this._terminalSelector} .${v}${x}.xterm-dim { color: ${e.color.multiplyOpacity(T,.5).css}; }${this._terminalSelector} .${m}${x} { background-color: ${T.css}; }`;k+=`${this._terminalSelector} .${v}${f.INVERTED_DEFAULT_COLOR} { color: ${e.color.opaque(y.background).css}; }${this._terminalSelector} .${v}${f.INVERTED_DEFAULT_COLOR}.xterm-dim { color: ${e.color.multiplyOpacity(e.color.opaque(y.background),.5).css}; }${this._terminalSelector} .${m}${f.INVERTED_DEFAULT_COLOR} { background-color: ${y.foreground.css}; }`,this._themeStyleElement.textContent=k}_setDefaultSpacing(){let y=this.dimensions.css.cell.width-this._widthCache.get("W",!1,!1);this._rowContainer.style.letterSpacing=`${y}px`,this._rowFactory.defaultSpacing=y}handleDevicePixelRatioChange(){this._updateDimensions(),this._widthCache.clear(),this._setDefaultSpacing()}_refreshRowElements(y,k){for(let x=this._rowElements.length;x<=k;x++){let T=document.createElement("div");this._rowContainer.appendChild(T),this._rowElements.push(T)}for(;this._rowElements.length>k;)this._rowContainer.removeChild(this._rowElements.pop())}handleResize(y,k){this._refreshRowElements(y,k),this._updateDimensions()}handleCharSizeChanged(){this._updateDimensions(),this._widthCache.clear(),this._setDefaultSpacing()}handleBlur(){this._rowContainer.classList.remove(h)}handleFocus(){this._rowContainer.classList.add(h),this.renderRows(this._bufferService.buffer.y,this._bufferService.buffer.y)}handleSelectionChanged(y,k,x){if(this._selectionContainer.replaceChildren(),this._rowFactory.handleSelectionChanged(y,k,x),this.renderRows(0,this._bufferService.rows-1),!y||!k)return;let T=y[1]-this._bufferService.buffer.ydisp,P=k[1]-this._bufferService.buffer.ydisp,M=Math.max(T,0),C=Math.min(P,this._bufferService.rows-1);if(M>=this._bufferService.rows||C<0)return;let w=document.createDocumentFragment();if(x){let E=y[0]>k[0];w.appendChild(this._createSelectionElement(M,E?k[0]:y[0],E?y[0]:k[0],C-M+1))}else{let E=T===M?y[0]:0,D=M===P?k[0]:this._bufferService.cols;w.appendChild(this._createSelectionElement(M,E,D));let I=C-M-1;if(w.appendChild(this._createSelectionElement(M+1,0,this._bufferService.cols,I)),M!==C){let H=P===C?k[0]:this._bufferService.cols;w.appendChild(this._createSelectionElement(C,0,H))}}this._selectionContainer.appendChild(w)}_createSelectionElement(y,k,x,T=1){let P=document.createElement("div");return P.style.height=T*this.dimensions.css.cell.height+"px",P.style.top=y*this.dimensions.css.cell.height+"px",P.style.left=k*this.dimensions.css.cell.width+"px",P.style.width=this.dimensions.css.cell.width*(x-k)+"px",P}handleCursorMove(){}_handleOptionsChanged(){this._updateDimensions(),this._injectCss(this._themeService.colors),this._widthCache.setFont(this._optionsService.rawOptions.fontFamily,this._optionsService.rawOptions.fontSize,this._optionsService.rawOptions.fontWeight,this._optionsService.rawOptions.fontWeightBold),this._setDefaultSpacing()}clear(){for(let y of this._rowElements)y.replaceChildren()}renderRows(y,k){let x=this._bufferService.buffer,T=x.ybase+x.y,P=Math.min(x.x,this._bufferService.cols-1),M=this._optionsService.rawOptions.cursorBlink,C=this._optionsService.rawOptions.cursorStyle,w=this._optionsService.rawOptions.cursorInactiveStyle;for(let E=y;E<=k;E++){let D=E+x.ydisp,I=this._rowElements[E],H=x.lines.get(D);if(!I||!H)break;I.replaceChildren(...this._rowFactory.createRow(H,D,D===T,C,w,P,M,this.dimensions.css.cell.width,this._widthCache,-1,-1))}}get _terminalSelector(){return`.${o}${this._terminalClass}`}_handleLinkHover(y){this._setCellUnderline(y.x1,y.x2,y.y1,y.y2,y.cols,!0)}_handleLinkLeave(y){this._setCellUnderline(y.x1,y.x2,y.y1,y.y2,y.cols,!1)}_setCellUnderline(y,k,x,T,P,M){x<0&&(y=0),T<0&&(k=0);let C=this._bufferService.rows-1;x=Math.max(Math.min(x,C),0),T=Math.max(Math.min(T,C),0),P=Math.min(P,this._bufferService.cols);let w=this._bufferService.buffer,E=w.ybase+w.y,D=Math.min(w.x,P-1),I=this._optionsService.rawOptions.cursorBlink,H=this._optionsService.rawOptions.cursorStyle,U=this._optionsService.rawOptions.cursorInactiveStyle;for(let W=x;W<=T;++W){let V=W+w.ydisp,S=this._rowElements[W],R=w.lines.get(V);if(!S||!R)break;S.replaceChildren(...this._rowFactory.createRow(R,V,V===E,H,U,D,I,this.dimensions.css.cell.width,this._widthCache,M?W===x?y:0:-1,M?(W===T?k:P)-1:-1))}}};r.DomRenderer=L=l([u(4,i.IInstantiationService),u(5,_.ICharSizeService),u(6,i.IOptionsService),u(7,i.IBufferService),u(8,_.ICoreBrowserService),u(9,_.IThemeService)],L)},3787:function(O,r,a){var l=this&&this.__decorate||function(v,m,h,g){var b,L=arguments.length,y=L<3?m:g===null?g=Object.getOwnPropertyDescriptor(m,h):g;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")y=Reflect.decorate(v,m,h,g);else for(var k=v.length-1;k>=0;k--)(b=v[k])&&(y=(L<3?b(y):L>3?b(m,h,y):b(m,h))||y);return L>3&&y&&Object.defineProperty(m,h,y),y},u=this&&this.__param||function(v,m){return function(h,g){m(h,g,v)}};Object.defineProperty(r,"__esModule",{value:!0}),r.DomRendererRowFactory=void 0;let n=a(2223),d=a(643),f=a(511),p=a(2585),_=a(8055),e=a(4725),s=a(4269),t=a(6171),i=a(3734),o=r.DomRendererRowFactory=class{constructor(v,m,h,g,b,L,y){this._document=v,this._characterJoinerService=m,this._optionsService=h,this._coreBrowserService=g,this._coreService=b,this._decorationService=L,this._themeService=y,this._workCell=new f.CellData,this._columnSelectMode=!1,this.defaultSpacing=0}handleSelectionChanged(v,m,h){this._selectionStart=v,this._selectionEnd=m,this._columnSelectMode=h}createRow(v,m,h,g,b,L,y,k,x,T,P){let M=[],C=this._characterJoinerService.getJoinedCharacters(m),w=this._themeService.colors,E,D=v.getNoBgTrimmedLength();h&&D<L+1&&(D=L+1);let I=0,H="",U=0,W=0,V=0,S=!1,R=0,B=!1,A=0,N=[],F=T!==-1&&P!==-1;for(let K=0;K<D;K++){v.loadCell(K,this._workCell);let X=this._workCell.getWidth();if(X===0)continue;let Y=!1,ie=K,$=this._workCell;if(C.length>0&&K===C[0][0]){Y=!0;let G=C.shift();$=new s.JoinedCellData(this._workCell,v.translateToString(!0,G[0],G[1]),G[1]-G[0]),ie=G[1]-1,X=$.getWidth()}let se=this._isCellInSelection(K,m),de=h&&K===L,_e=F&&K>=T&&K<=P,ue=!1;this._decorationService.forEachDecorationAtCell(K,m,void 0,(G=>{ue=!0}));let ae=$.getChars()||d.WHITESPACE_CELL_CHAR;if(ae===" "&&($.isUnderline()||$.isOverline())&&(ae="\xA0"),A=X*k-x.get(ae,$.isBold(),$.isItalic()),E){if(I&&(se&&B||!se&&!B&&$.bg===U)&&(se&&B&&w.selectionForeground||$.fg===W)&&$.extended.ext===V&&_e===S&&A===R&&!de&&!Y&&!ue){H+=ae,I++;continue}I&&(E.textContent=H),E=this._document.createElement("span"),I=0,H=""}else E=this._document.createElement("span");if(U=$.bg,W=$.fg,V=$.extended.ext,S=_e,R=A,B=se,Y&&L>=K&&L<=ie&&(L=K),!this._coreService.isCursorHidden&&de){if(N.push("xterm-cursor"),this._coreBrowserService.isFocused)y&&N.push("xterm-cursor-blink"),N.push(g==="bar"?"xterm-cursor-bar":g==="underline"?"xterm-cursor-underline":"xterm-cursor-block");else if(b)switch(b){case"outline":N.push("xterm-cursor-outline");break;case"block":N.push("xterm-cursor-block");break;case"bar":N.push("xterm-cursor-bar");break;case"underline":N.push("xterm-cursor-underline")}}if($.isBold()&&N.push("xterm-bold"),$.isItalic()&&N.push("xterm-italic"),$.isDim()&&N.push("xterm-dim"),H=$.isInvisible()?d.WHITESPACE_CELL_CHAR:$.getChars()||d.WHITESPACE_CELL_CHAR,$.isUnderline()&&(N.push(`xterm-underline-${$.extended.underlineStyle}`),H===" "&&(H="\xA0"),!$.isUnderlineColorDefault()))if($.isUnderlineColorRGB())E.style.textDecorationColor=`rgb(${i.AttributeData.toColorRGB($.getUnderlineColor()).join(",")})`;else{let G=$.getUnderlineColor();this._optionsService.rawOptions.drawBoldTextInBrightColors&&$.isBold()&&G<8&&(G+=8),E.style.textDecorationColor=w.ansi[G].css}$.isOverline()&&(N.push("xterm-overline"),H===" "&&(H="\xA0")),$.isStrikethrough()&&N.push("xterm-strikethrough"),_e&&(E.style.textDecoration="underline");let Z=$.getFgColor(),re=$.getFgColorMode(),Q=$.getBgColor(),ne=$.getBgColorMode(),fe=!!$.isInverse();if(fe){let G=Z;Z=Q,Q=G;let Le=re;re=ne,ne=Le}let ee,ve,te,oe=!1;switch(this._decorationService.forEachDecorationAtCell(K,m,void 0,(G=>{G.options.layer!=="top"&&oe||(G.backgroundColorRGB&&(ne=50331648,Q=G.backgroundColorRGB.rgba>>8&16777215,ee=G.backgroundColorRGB),G.foregroundColorRGB&&(re=50331648,Z=G.foregroundColorRGB.rgba>>8&16777215,ve=G.foregroundColorRGB),oe=G.options.layer==="top")})),!oe&&se&&(ee=this._coreBrowserService.isFocused?w.selectionBackgroundOpaque:w.selectionInactiveBackgroundOpaque,Q=ee.rgba>>8&16777215,ne=50331648,oe=!0,w.selectionForeground&&(re=50331648,Z=w.selectionForeground.rgba>>8&16777215,ve=w.selectionForeground)),oe&&N.push("xterm-decoration-top"),ne){case 16777216:case 33554432:te=w.ansi[Q],N.push(`xterm-bg-${Q}`);break;case 50331648:te=_.rgba.toColor(Q>>16,Q>>8&255,255&Q),this._addStyle(E,`background-color:#${c((Q>>>0).toString(16),"0",6)}`);break;default:fe?(te=w.foreground,N.push(`xterm-bg-${n.INVERTED_DEFAULT_COLOR}`)):te=w.background}switch(ee||$.isDim()&&(ee=_.color.multiplyOpacity(te,.5)),re){case 16777216:case 33554432:$.isBold()&&Z<8&&this._optionsService.rawOptions.drawBoldTextInBrightColors&&(Z+=8),this._applyMinimumContrast(E,te,w.ansi[Z],$,ee,void 0)||N.push(`xterm-fg-${Z}`);break;case 50331648:let G=_.rgba.toColor(Z>>16&255,Z>>8&255,255&Z);this._applyMinimumContrast(E,te,G,$,ee,ve)||this._addStyle(E,`color:#${c(Z.toString(16),"0",6)}`);break;default:this._applyMinimumContrast(E,te,w.foreground,$,ee,void 0)||fe&&N.push(`xterm-fg-${n.INVERTED_DEFAULT_COLOR}`)}N.length&&(E.className=N.join(" "),N.length=0),de||Y||ue?E.textContent=H:I++,A!==this.defaultSpacing&&(E.style.letterSpacing=`${A}px`),M.push(E),K=ie}return E&&I&&(E.textContent=H),M}_applyMinimumContrast(v,m,h,g,b,L){if(this._optionsService.rawOptions.minimumContrastRatio===1||(0,t.excludeFromContrastRatioDemands)(g.getCode()))return!1;let y=this._getContrastCache(g),k;if(b||L||(k=y.getColor(m.rgba,h.rgba)),k===void 0){let x=this._optionsService.rawOptions.minimumContrastRatio/(g.isDim()?2:1);k=_.color.ensureContrastRatio(b||m,L||h,x),y.setColor((b||m).rgba,(L||h).rgba,k??null)}return!!k&&(this._addStyle(v,`color:${k.css}`),!0)}_getContrastCache(v){return v.isDim()?this._themeService.colors.halfContrastCache:this._themeService.colors.contrastCache}_addStyle(v,m){v.setAttribute("style",`${v.getAttribute("style")||""}${m};`)}_isCellInSelection(v,m){let h=this._selectionStart,g=this._selectionEnd;return!(!h||!g)&&(this._columnSelectMode?h[0]<=g[0]?v>=h[0]&&m>=h[1]&&v<g[0]&&m<=g[1]:v<h[0]&&m>=h[1]&&v>=g[0]&&m<=g[1]:m>h[1]&&m<g[1]||h[1]===g[1]&&m===h[1]&&v>=h[0]&&v<g[0]||h[1]<g[1]&&m===g[1]&&v<g[0]||h[1]<g[1]&&m===h[1]&&v>=h[0])}};function c(v,m,h){for(;v.length<h;)v=m+v;return v}r.DomRendererRowFactory=o=l([u(1,e.ICharacterJoinerService),u(2,p.IOptionsService),u(3,e.ICoreBrowserService),u(4,p.ICoreService),u(5,p.IDecorationService),u(6,e.IThemeService)],o)},2550:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.WidthCache=void 0,r.WidthCache=class{constructor(a){this._flat=new Float32Array(256),this._font="",this._fontSize=0,this._weight="normal",this._weightBold="bold",this._measureElements=[],this._container=a.createElement("div"),this._container.style.position="absolute",this._container.style.top="-50000px",this._container.style.width="50000px",this._container.style.whiteSpace="pre",this._container.style.fontKerning="none";let l=a.createElement("span"),u=a.createElement("span");u.style.fontWeight="bold";let n=a.createElement("span");n.style.fontStyle="italic";let d=a.createElement("span");d.style.fontWeight="bold",d.style.fontStyle="italic",this._measureElements=[l,u,n,d],this._container.appendChild(l),this._container.appendChild(u),this._container.appendChild(n),this._container.appendChild(d),a.body.appendChild(this._container),this.clear()}dispose(){this._container.remove(),this._measureElements.length=0,this._holey=void 0}clear(){this._flat.fill(-9999),this._holey=new Map}setFont(a,l,u,n){a===this._font&&l===this._fontSize&&u===this._weight&&n===this._weightBold||(this._font=a,this._fontSize=l,this._weight=u,this._weightBold=n,this._container.style.fontFamily=this._font,this._container.style.fontSize=`${this._fontSize}px`,this._measureElements[0].style.fontWeight=`${u}`,this._measureElements[1].style.fontWeight=`${n}`,this._measureElements[2].style.fontWeight=`${u}`,this._measureElements[3].style.fontWeight=`${n}`,this.clear())}get(a,l,u){let n=0;if(!l&&!u&&a.length===1&&(n=a.charCodeAt(0))<256)return this._flat[n]!==-9999?this._flat[n]:this._flat[n]=this._measure(a,0);let d=a;l&&(d+="B"),u&&(d+="I");let f=this._holey.get(d);if(f===void 0){let p=0;l&&(p|=1),u&&(p|=2),f=this._measure(a,p),this._holey.set(d,f)}return f}_measure(a,l){let u=this._measureElements[l];return u.textContent=a.repeat(32),u.offsetWidth/32}}},2223:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.TEXT_BASELINE=r.DIM_OPACITY=r.INVERTED_DEFAULT_COLOR=void 0;let l=a(6114);r.INVERTED_DEFAULT_COLOR=257,r.DIM_OPACITY=.5,r.TEXT_BASELINE=l.isFirefox||l.isLegacyEdge?"bottom":"ideographic"},6171:(O,r)=>{function a(l){return 57508<=l&&l<=57558}Object.defineProperty(r,"__esModule",{value:!0}),r.createRenderDimensions=r.excludeFromContrastRatioDemands=r.isRestrictedPowerlineGlyph=r.isPowerlineGlyph=r.throwIfFalsy=void 0,r.throwIfFalsy=function(l){if(!l)throw new Error("value must not be falsy");return l},r.isPowerlineGlyph=a,r.isRestrictedPowerlineGlyph=function(l){return 57520<=l&&l<=57527},r.excludeFromContrastRatioDemands=function(l){return a(l)||(function(u){return 9472<=u&&u<=9631})(l)},r.createRenderDimensions=function(){return{css:{canvas:{width:0,height:0},cell:{width:0,height:0}},device:{canvas:{width:0,height:0},cell:{width:0,height:0},char:{width:0,height:0,left:0,top:0}}}}},456:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.SelectionModel=void 0,r.SelectionModel=class{constructor(a){this._bufferService=a,this.isSelectAllActive=!1,this.selectionStartLength=0}clearSelection(){this.selectionStart=void 0,this.selectionEnd=void 0,this.isSelectAllActive=!1,this.selectionStartLength=0}get finalSelectionStart(){return this.isSelectAllActive?[0,0]:this.selectionEnd&&this.selectionStart&&this.areSelectionValuesReversed()?this.selectionEnd:this.selectionStart}get finalSelectionEnd(){if(this.isSelectAllActive)return[this._bufferService.cols,this._bufferService.buffer.ybase+this._bufferService.rows-1];if(this.selectionStart){if(!this.selectionEnd||this.areSelectionValuesReversed()){let a=this.selectionStart[0]+this.selectionStartLength;return a>this._bufferService.cols?a%this._bufferService.cols==0?[this._bufferService.cols,this.selectionStart[1]+Math.floor(a/this._bufferService.cols)-1]:[a%this._bufferService.cols,this.selectionStart[1]+Math.floor(a/this._bufferService.cols)]:[a,this.selectionStart[1]]}if(this.selectionStartLength&&this.selectionEnd[1]===this.selectionStart[1]){let a=this.selectionStart[0]+this.selectionStartLength;return a>this._bufferService.cols?[a%this._bufferService.cols,this.selectionStart[1]+Math.floor(a/this._bufferService.cols)]:[Math.max(a,this.selectionEnd[0]),this.selectionEnd[1]]}return this.selectionEnd}}areSelectionValuesReversed(){let a=this.selectionStart,l=this.selectionEnd;return!(!a||!l)&&(a[1]>l[1]||a[1]===l[1]&&a[0]>l[0])}handleTrim(a){return this.selectionStart&&(this.selectionStart[1]-=a),this.selectionEnd&&(this.selectionEnd[1]-=a),this.selectionEnd&&this.selectionEnd[1]<0?(this.clearSelection(),!0):(this.selectionStart&&this.selectionStart[1]<0&&(this.selectionStart[1]=0),!1)}}},428:function(O,r,a){var l=this&&this.__decorate||function(e,s,t,i){var o,c=arguments.length,v=c<3?s:i===null?i=Object.getOwnPropertyDescriptor(s,t):i;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")v=Reflect.decorate(e,s,t,i);else for(var m=e.length-1;m>=0;m--)(o=e[m])&&(v=(c<3?o(v):c>3?o(s,t,v):o(s,t))||v);return c>3&&v&&Object.defineProperty(s,t,v),v},u=this&&this.__param||function(e,s){return function(t,i){s(t,i,e)}};Object.defineProperty(r,"__esModule",{value:!0}),r.CharSizeService=void 0;let n=a(2585),d=a(8460),f=a(844),p=r.CharSizeService=class extends f.Disposable{get hasValidSize(){return this.width>0&&this.height>0}constructor(e,s,t){super(),this._optionsService=t,this.width=0,this.height=0,this._onCharSizeChange=this.register(new d.EventEmitter),this.onCharSizeChange=this._onCharSizeChange.event,this._measureStrategy=new _(e,s,this._optionsService),this.register(this._optionsService.onMultipleOptionChange(["fontFamily","fontSize"],(()=>this.measure())))}measure(){let e=this._measureStrategy.measure();e.width===this.width&&e.height===this.height||(this.width=e.width,this.height=e.height,this._onCharSizeChange.fire())}};r.CharSizeService=p=l([u(2,n.IOptionsService)],p);class _{constructor(s,t,i){this._document=s,this._parentElement=t,this._optionsService=i,this._result={width:0,height:0},this._measureElement=this._document.createElement("span"),this._measureElement.classList.add("xterm-char-measure-element"),this._measureElement.textContent="W".repeat(32),this._measureElement.setAttribute("aria-hidden","true"),this._measureElement.style.whiteSpace="pre",this._measureElement.style.fontKerning="none",this._parentElement.appendChild(this._measureElement)}measure(){this._measureElement.style.fontFamily=this._optionsService.rawOptions.fontFamily,this._measureElement.style.fontSize=`${this._optionsService.rawOptions.fontSize}px`;let s={height:Number(this._measureElement.offsetHeight),width:Number(this._measureElement.offsetWidth)};return s.width!==0&&s.height!==0&&(this._result.width=s.width/32,this._result.height=Math.ceil(s.height)),this._result}}},4269:function(O,r,a){var l=this&&this.__decorate||function(s,t,i,o){var c,v=arguments.length,m=v<3?t:o===null?o=Object.getOwnPropertyDescriptor(t,i):o;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")m=Reflect.decorate(s,t,i,o);else for(var h=s.length-1;h>=0;h--)(c=s[h])&&(m=(v<3?c(m):v>3?c(t,i,m):c(t,i))||m);return v>3&&m&&Object.defineProperty(t,i,m),m},u=this&&this.__param||function(s,t){return function(i,o){t(i,o,s)}};Object.defineProperty(r,"__esModule",{value:!0}),r.CharacterJoinerService=r.JoinedCellData=void 0;let n=a(3734),d=a(643),f=a(511),p=a(2585);class _ extends n.AttributeData{constructor(t,i,o){super(),this.content=0,this.combinedData="",this.fg=t.fg,this.bg=t.bg,this.combinedData=i,this._width=o}isCombined(){return 2097152}getWidth(){return this._width}getChars(){return this.combinedData}getCode(){return 2097151}setFromCharData(t){throw new Error("not implemented")}getAsCharData(){return[this.fg,this.getChars(),this.getWidth(),this.getCode()]}}r.JoinedCellData=_;let e=r.CharacterJoinerService=class be{constructor(t){this._bufferService=t,this._characterJoiners=[],this._nextCharacterJoinerId=0,this._workCell=new f.CellData}register(t){let i={id:this._nextCharacterJoinerId++,handler:t};return this._characterJoiners.push(i),i.id}deregister(t){for(let i=0;i<this._characterJoiners.length;i++)if(this._characterJoiners[i].id===t)return this._characterJoiners.splice(i,1),!0;return!1}getJoinedCharacters(t){if(this._characterJoiners.length===0)return[];let i=this._bufferService.buffer.lines.get(t);if(!i||i.length===0)return[];let o=[],c=i.translateToString(!0),v=0,m=0,h=0,g=i.getFg(0),b=i.getBg(0);for(let L=0;L<i.getTrimmedLength();L++)if(i.loadCell(L,this._workCell),this._workCell.getWidth()!==0){if(this._workCell.fg!==g||this._workCell.bg!==b){if(L-v>1){let y=this._getJoinedRanges(c,h,m,i,v);for(let k=0;k<y.length;k++)o.push(y[k])}v=L,h=m,g=this._workCell.fg,b=this._workCell.bg}m+=this._workCell.getChars().length||d.WHITESPACE_CELL_CHAR.length}if(this._bufferService.cols-v>1){let L=this._getJoinedRanges(c,h,m,i,v);for(let y=0;y<L.length;y++)o.push(L[y])}return o}_getJoinedRanges(t,i,o,c,v){let m=t.substring(i,o),h=[];try{h=this._characterJoiners[0].handler(m)}catch(g){console.error(g)}for(let g=1;g<this._characterJoiners.length;g++)try{let b=this._characterJoiners[g].handler(m);for(let L=0;L<b.length;L++)be._mergeRanges(h,b[L])}catch(b){console.error(b)}return this._stringRangesToCellRanges(h,c,v),h}_stringRangesToCellRanges(t,i,o){let c=0,v=!1,m=0,h=t[c];if(h){for(let g=o;g<this._bufferService.cols;g++){let b=i.getWidth(g),L=i.getString(g).length||d.WHITESPACE_CELL_CHAR.length;if(b!==0){if(!v&&h[0]<=m&&(h[0]=g,v=!0),h[1]<=m){if(h[1]=g,h=t[++c],!h)break;h[0]<=m?(h[0]=g,v=!0):v=!1}m+=L}}h&&(h[1]=this._bufferService.cols)}}static _mergeRanges(t,i){let o=!1;for(let c=0;c<t.length;c++){let v=t[c];if(o){if(i[1]<=v[0])return t[c-1][1]=i[1],t;if(i[1]<=v[1])return t[c-1][1]=Math.max(i[1],v[1]),t.splice(c,1),t;t.splice(c,1),c--}else{if(i[1]<=v[0])return t.splice(c,0,i),t;if(i[1]<=v[1])return v[0]=Math.min(i[0],v[0]),t;i[0]<v[1]&&(v[0]=Math.min(i[0],v[0]),o=!0)}}return o?t[t.length-1][1]=i[1]:t.push(i),t}};r.CharacterJoinerService=e=l([u(0,p.IBufferService)],e)},5114:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.CoreBrowserService=void 0,r.CoreBrowserService=class{constructor(a,l){this._textarea=a,this.window=l,this._isFocused=!1,this._cachedIsFocused=void 0,this._textarea.addEventListener("focus",(()=>this._isFocused=!0)),this._textarea.addEventListener("blur",(()=>this._isFocused=!1))}get dpr(){return this.window.devicePixelRatio}get isFocused(){return this._cachedIsFocused===void 0&&(this._cachedIsFocused=this._isFocused&&this._textarea.ownerDocument.hasFocus(),queueMicrotask((()=>this._cachedIsFocused=void 0))),this._cachedIsFocused}}},8934:function(O,r,a){var l=this&&this.__decorate||function(p,_,e,s){var t,i=arguments.length,o=i<3?_:s===null?s=Object.getOwnPropertyDescriptor(_,e):s;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")o=Reflect.decorate(p,_,e,s);else for(var c=p.length-1;c>=0;c--)(t=p[c])&&(o=(i<3?t(o):i>3?t(_,e,o):t(_,e))||o);return i>3&&o&&Object.defineProperty(_,e,o),o},u=this&&this.__param||function(p,_){return function(e,s){_(e,s,p)}};Object.defineProperty(r,"__esModule",{value:!0}),r.MouseService=void 0;let n=a(4725),d=a(9806),f=r.MouseService=class{constructor(p,_){this._renderService=p,this._charSizeService=_}getCoords(p,_,e,s,t){return(0,d.getCoords)(window,p,_,e,s,this._charSizeService.hasValidSize,this._renderService.dimensions.css.cell.width,this._renderService.dimensions.css.cell.height,t)}getMouseReportCoords(p,_){let e=(0,d.getCoordsRelativeToElement)(window,p,_);if(this._charSizeService.hasValidSize)return e[0]=Math.min(Math.max(e[0],0),this._renderService.dimensions.css.canvas.width-1),e[1]=Math.min(Math.max(e[1],0),this._renderService.dimensions.css.canvas.height-1),{col:Math.floor(e[0]/this._renderService.dimensions.css.cell.width),row:Math.floor(e[1]/this._renderService.dimensions.css.cell.height),x:Math.floor(e[0]),y:Math.floor(e[1])}}};r.MouseService=f=l([u(0,n.IRenderService),u(1,n.ICharSizeService)],f)},3230:function(O,r,a){var l=this&&this.__decorate||function(o,c,v,m){var h,g=arguments.length,b=g<3?c:m===null?m=Object.getOwnPropertyDescriptor(c,v):m;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")b=Reflect.decorate(o,c,v,m);else for(var L=o.length-1;L>=0;L--)(h=o[L])&&(b=(g<3?h(b):g>3?h(c,v,b):h(c,v))||b);return g>3&&b&&Object.defineProperty(c,v,b),b},u=this&&this.__param||function(o,c){return function(v,m){c(v,m,o)}};Object.defineProperty(r,"__esModule",{value:!0}),r.RenderService=void 0;let n=a(3656),d=a(6193),f=a(5596),p=a(4725),_=a(8460),e=a(844),s=a(7226),t=a(2585),i=r.RenderService=class extends e.Disposable{get dimensions(){return this._renderer.value.dimensions}constructor(o,c,v,m,h,g,b,L){if(super(),this._rowCount=o,this._charSizeService=m,this._renderer=this.register(new e.MutableDisposable),this._pausedResizeTask=new s.DebouncedIdleTask,this._isPaused=!1,this._needsFullRefresh=!1,this._isNextRenderRedrawOnly=!0,this._needsSelectionRefresh=!1,this._canvasWidth=0,this._canvasHeight=0,this._selectionState={start:void 0,end:void 0,columnSelectMode:!1},this._onDimensionsChange=this.register(new _.EventEmitter),this.onDimensionsChange=this._onDimensionsChange.event,this._onRenderedViewportChange=this.register(new _.EventEmitter),this.onRenderedViewportChange=this._onRenderedViewportChange.event,this._onRender=this.register(new _.EventEmitter),this.onRender=this._onRender.event,this._onRefreshRequest=this.register(new _.EventEmitter),this.onRefreshRequest=this._onRefreshRequest.event,this._renderDebouncer=new d.RenderDebouncer(b.window,((y,k)=>this._renderRows(y,k))),this.register(this._renderDebouncer),this._screenDprMonitor=new f.ScreenDprMonitor(b.window),this._screenDprMonitor.setListener((()=>this.handleDevicePixelRatioChange())),this.register(this._screenDprMonitor),this.register(g.onResize((()=>this._fullRefresh()))),this.register(g.buffers.onBufferActivate((()=>{var y;return(y=this._renderer.value)===null||y===void 0?void 0:y.clear()}))),this.register(v.onOptionChange((()=>this._handleOptionsChanged()))),this.register(this._charSizeService.onCharSizeChange((()=>this.handleCharSizeChanged()))),this.register(h.onDecorationRegistered((()=>this._fullRefresh()))),this.register(h.onDecorationRemoved((()=>this._fullRefresh()))),this.register(v.onMultipleOptionChange(["customGlyphs","drawBoldTextInBrightColors","letterSpacing","lineHeight","fontFamily","fontSize","fontWeight","fontWeightBold","minimumContrastRatio"],(()=>{this.clear(),this.handleResize(g.cols,g.rows),this._fullRefresh()}))),this.register(v.onMultipleOptionChange(["cursorBlink","cursorStyle"],(()=>this.refreshRows(g.buffer.y,g.buffer.y,!0)))),this.register((0,n.addDisposableDomListener)(b.window,"resize",(()=>this.handleDevicePixelRatioChange()))),this.register(L.onChangeColors((()=>this._fullRefresh()))),"IntersectionObserver"in b.window){let y=new b.window.IntersectionObserver((k=>this._handleIntersectionChange(k[k.length-1])),{threshold:0});y.observe(c),this.register({dispose:()=>y.disconnect()})}}_handleIntersectionChange(o){this._isPaused=o.isIntersecting===void 0?o.intersectionRatio===0:!o.isIntersecting,this._isPaused||this._charSizeService.hasValidSize||this._charSizeService.measure(),!this._isPaused&&this._needsFullRefresh&&(this._pausedResizeTask.flush(),this.refreshRows(0,this._rowCount-1),this._needsFullRefresh=!1)}refreshRows(o,c,v=!1){this._isPaused?this._needsFullRefresh=!0:(v||(this._isNextRenderRedrawOnly=!1),this._renderDebouncer.refresh(o,c,this._rowCount))}_renderRows(o,c){this._renderer.value&&(o=Math.min(o,this._rowCount-1),c=Math.min(c,this._rowCount-1),this._renderer.value.renderRows(o,c),this._needsSelectionRefresh&&(this._renderer.value.handleSelectionChanged(this._selectionState.start,this._selectionState.end,this._selectionState.columnSelectMode),this._needsSelectionRefresh=!1),this._isNextRenderRedrawOnly||this._onRenderedViewportChange.fire({start:o,end:c}),this._onRender.fire({start:o,end:c}),this._isNextRenderRedrawOnly=!0)}resize(o,c){this._rowCount=c,this._fireOnCanvasResize()}_handleOptionsChanged(){this._renderer.value&&(this.refreshRows(0,this._rowCount-1),this._fireOnCanvasResize())}_fireOnCanvasResize(){this._renderer.value&&(this._renderer.value.dimensions.css.canvas.width===this._canvasWidth&&this._renderer.value.dimensions.css.canvas.height===this._canvasHeight||this._onDimensionsChange.fire(this._renderer.value.dimensions))}hasRenderer(){return!!this._renderer.value}setRenderer(o){this._renderer.value=o,this._renderer.value.onRequestRedraw((c=>this.refreshRows(c.start,c.end,!0))),this._needsSelectionRefresh=!0,this._fullRefresh()}addRefreshCallback(o){return this._renderDebouncer.addRefreshCallback(o)}_fullRefresh(){this._isPaused?this._needsFullRefresh=!0:this.refreshRows(0,this._rowCount-1)}clearTextureAtlas(){var o,c;this._renderer.value&&((c=(o=this._renderer.value).clearTextureAtlas)===null||c===void 0||c.call(o),this._fullRefresh())}handleDevicePixelRatioChange(){this._charSizeService.measure(),this._renderer.value&&(this._renderer.value.handleDevicePixelRatioChange(),this.refreshRows(0,this._rowCount-1))}handleResize(o,c){this._renderer.value&&(this._isPaused?this._pausedResizeTask.set((()=>this._renderer.value.handleResize(o,c))):this._renderer.value.handleResize(o,c),this._fullRefresh())}handleCharSizeChanged(){var o;(o=this._renderer.value)===null||o===void 0||o.handleCharSizeChanged()}handleBlur(){var o;(o=this._renderer.value)===null||o===void 0||o.handleBlur()}handleFocus(){var o;(o=this._renderer.value)===null||o===void 0||o.handleFocus()}handleSelectionChanged(o,c,v){var m;this._selectionState.start=o,this._selectionState.end=c,this._selectionState.columnSelectMode=v,(m=this._renderer.value)===null||m===void 0||m.handleSelectionChanged(o,c,v)}handleCursorMove(){var o;(o=this._renderer.value)===null||o===void 0||o.handleCursorMove()}clear(){var o;(o=this._renderer.value)===null||o===void 0||o.clear()}};r.RenderService=i=l([u(2,t.IOptionsService),u(3,p.ICharSizeService),u(4,t.IDecorationService),u(5,t.IBufferService),u(6,p.ICoreBrowserService),u(7,p.IThemeService)],i)},9312:function(O,r,a){var l=this&&this.__decorate||function(h,g,b,L){var y,k=arguments.length,x=k<3?g:L===null?L=Object.getOwnPropertyDescriptor(g,b):L;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")x=Reflect.decorate(h,g,b,L);else for(var T=h.length-1;T>=0;T--)(y=h[T])&&(x=(k<3?y(x):k>3?y(g,b,x):y(g,b))||x);return k>3&&x&&Object.defineProperty(g,b,x),x},u=this&&this.__param||function(h,g){return function(b,L){g(b,L,h)}};Object.defineProperty(r,"__esModule",{value:!0}),r.SelectionService=void 0;let n=a(9806),d=a(9504),f=a(456),p=a(4725),_=a(8460),e=a(844),s=a(6114),t=a(4841),i=a(511),o=a(2585),c="\xA0",v=new RegExp(c,"g"),m=r.SelectionService=class extends e.Disposable{constructor(h,g,b,L,y,k,x,T,P){super(),this._element=h,this._screenElement=g,this._linkifier=b,this._bufferService=L,this._coreService=y,this._mouseService=k,this._optionsService=x,this._renderService=T,this._coreBrowserService=P,this._dragScrollAmount=0,this._enabled=!0,this._workCell=new i.CellData,this._mouseDownTimeStamp=0,this._oldHasSelection=!1,this._oldSelectionStart=void 0,this._oldSelectionEnd=void 0,this._onLinuxMouseSelection=this.register(new _.EventEmitter),this.onLinuxMouseSelection=this._onLinuxMouseSelection.event,this._onRedrawRequest=this.register(new _.EventEmitter),this.onRequestRedraw=this._onRedrawRequest.event,this._onSelectionChange=this.register(new _.EventEmitter),this.onSelectionChange=this._onSelectionChange.event,this._onRequestScrollLines=this.register(new _.EventEmitter),this.onRequestScrollLines=this._onRequestScrollLines.event,this._mouseMoveListener=M=>this._handleMouseMove(M),this._mouseUpListener=M=>this._handleMouseUp(M),this._coreService.onUserInput((()=>{this.hasSelection&&this.clearSelection()})),this._trimListener=this._bufferService.buffer.lines.onTrim((M=>this._handleTrim(M))),this.register(this._bufferService.buffers.onBufferActivate((M=>this._handleBufferActivate(M)))),this.enable(),this._model=new f.SelectionModel(this._bufferService),this._activeSelectionMode=0,this.register((0,e.toDisposable)((()=>{this._removeMouseDownListeners()})))}reset(){this.clearSelection()}disable(){this.clearSelection(),this._enabled=!1}enable(){this._enabled=!0}get selectionStart(){return this._model.finalSelectionStart}get selectionEnd(){return this._model.finalSelectionEnd}get hasSelection(){let h=this._model.finalSelectionStart,g=this._model.finalSelectionEnd;return!(!h||!g||h[0]===g[0]&&h[1]===g[1])}get selectionText(){let h=this._model.finalSelectionStart,g=this._model.finalSelectionEnd;if(!h||!g)return"";let b=this._bufferService.buffer,L=[];if(this._activeSelectionMode===3){if(h[0]===g[0])return"";let y=h[0]<g[0]?h[0]:g[0],k=h[0]<g[0]?g[0]:h[0];for(let x=h[1];x<=g[1];x++){let T=b.translateBufferLineToString(x,!0,y,k);L.push(T)}}else{let y=h[1]===g[1]?g[0]:void 0;L.push(b.translateBufferLineToString(h[1],!0,h[0],y));for(let k=h[1]+1;k<=g[1]-1;k++){let x=b.lines.get(k),T=b.translateBufferLineToString(k,!0);x?.isWrapped?L[L.length-1]+=T:L.push(T)}if(h[1]!==g[1]){let k=b.lines.get(g[1]),x=b.translateBufferLineToString(g[1],!0,0,g[0]);k&&k.isWrapped?L[L.length-1]+=x:L.push(x)}}return L.map((y=>y.replace(v," "))).join(s.isWindows?`\r
`:`
`)}clearSelection(){this._model.clearSelection(),this._removeMouseDownListeners(),this.refresh(),this._onSelectionChange.fire()}refresh(h){this._refreshAnimationFrame||(this._refreshAnimationFrame=this._coreBrowserService.window.requestAnimationFrame((()=>this._refresh()))),s.isLinux&&h&&this.selectionText.length&&this._onLinuxMouseSelection.fire(this.selectionText)}_refresh(){this._refreshAnimationFrame=void 0,this._onRedrawRequest.fire({start:this._model.finalSelectionStart,end:this._model.finalSelectionEnd,columnSelectMode:this._activeSelectionMode===3})}_isClickInSelection(h){let g=this._getMouseBufferCoords(h),b=this._model.finalSelectionStart,L=this._model.finalSelectionEnd;return!!(b&&L&&g)&&this._areCoordsInSelection(g,b,L)}isCellInSelection(h,g){let b=this._model.finalSelectionStart,L=this._model.finalSelectionEnd;return!(!b||!L)&&this._areCoordsInSelection([h,g],b,L)}_areCoordsInSelection(h,g,b){return h[1]>g[1]&&h[1]<b[1]||g[1]===b[1]&&h[1]===g[1]&&h[0]>=g[0]&&h[0]<b[0]||g[1]<b[1]&&h[1]===b[1]&&h[0]<b[0]||g[1]<b[1]&&h[1]===g[1]&&h[0]>=g[0]}_selectWordAtCursor(h,g){var b,L;let y=(L=(b=this._linkifier.currentLink)===null||b===void 0?void 0:b.link)===null||L===void 0?void 0:L.range;if(y)return this._model.selectionStart=[y.start.x-1,y.start.y-1],this._model.selectionStartLength=(0,t.getRangeLength)(y,this._bufferService.cols),this._model.selectionEnd=void 0,!0;let k=this._getMouseBufferCoords(h);return!!k&&(this._selectWordAt(k,g),this._model.selectionEnd=void 0,!0)}selectAll(){this._model.isSelectAllActive=!0,this.refresh(),this._onSelectionChange.fire()}selectLines(h,g){this._model.clearSelection(),h=Math.max(h,0),g=Math.min(g,this._bufferService.buffer.lines.length-1),this._model.selectionStart=[0,h],this._model.selectionEnd=[this._bufferService.cols,g],this.refresh(),this._onSelectionChange.fire()}_handleTrim(h){this._model.handleTrim(h)&&this.refresh()}_getMouseBufferCoords(h){let g=this._mouseService.getCoords(h,this._screenElement,this._bufferService.cols,this._bufferService.rows,!0);if(g)return g[0]--,g[1]--,g[1]+=this._bufferService.buffer.ydisp,g}_getMouseEventScrollAmount(h){let g=(0,n.getCoordsRelativeToElement)(this._coreBrowserService.window,h,this._screenElement)[1],b=this._renderService.dimensions.css.canvas.height;return g>=0&&g<=b?0:(g>b&&(g-=b),g=Math.min(Math.max(g,-50),50),g/=50,g/Math.abs(g)+Math.round(14*g))}shouldForceSelection(h){return s.isMac?h.altKey&&this._optionsService.rawOptions.macOptionClickForcesSelection:h.shiftKey}handleMouseDown(h){if(this._mouseDownTimeStamp=h.timeStamp,(h.button!==2||!this.hasSelection)&&h.button===0){if(!this._enabled){if(!this.shouldForceSelection(h))return;h.stopPropagation()}h.preventDefault(),this._dragScrollAmount=0,this._enabled&&h.shiftKey?this._handleIncrementalClick(h):h.detail===1?this._handleSingleClick(h):h.detail===2?this._handleDoubleClick(h):h.detail===3&&this._handleTripleClick(h),this._addMouseDownListeners(),this.refresh(!0)}}_addMouseDownListeners(){this._screenElement.ownerDocument&&(this._screenElement.ownerDocument.addEventListener("mousemove",this._mouseMoveListener),this._screenElement.ownerDocument.addEventListener("mouseup",this._mouseUpListener)),this._dragScrollIntervalTimer=this._coreBrowserService.window.setInterval((()=>this._dragScroll()),50)}_removeMouseDownListeners(){this._screenElement.ownerDocument&&(this._screenElement.ownerDocument.removeEventListener("mousemove",this._mouseMoveListener),this._screenElement.ownerDocument.removeEventListener("mouseup",this._mouseUpListener)),this._coreBrowserService.window.clearInterval(this._dragScrollIntervalTimer),this._dragScrollIntervalTimer=void 0}_handleIncrementalClick(h){this._model.selectionStart&&(this._model.selectionEnd=this._getMouseBufferCoords(h))}_handleSingleClick(h){if(this._model.selectionStartLength=0,this._model.isSelectAllActive=!1,this._activeSelectionMode=this.shouldColumnSelect(h)?3:0,this._model.selectionStart=this._getMouseBufferCoords(h),!this._model.selectionStart)return;this._model.selectionEnd=void 0;let g=this._bufferService.buffer.lines.get(this._model.selectionStart[1]);g&&g.length!==this._model.selectionStart[0]&&g.hasWidth(this._model.selectionStart[0])===0&&this._model.selectionStart[0]++}_handleDoubleClick(h){this._selectWordAtCursor(h,!0)&&(this._activeSelectionMode=1)}_handleTripleClick(h){let g=this._getMouseBufferCoords(h);g&&(this._activeSelectionMode=2,this._selectLineAt(g[1]))}shouldColumnSelect(h){return h.altKey&&!(s.isMac&&this._optionsService.rawOptions.macOptionClickForcesSelection)}_handleMouseMove(h){if(h.stopImmediatePropagation(),!this._model.selectionStart)return;let g=this._model.selectionEnd?[this._model.selectionEnd[0],this._model.selectionEnd[1]]:null;if(this._model.selectionEnd=this._getMouseBufferCoords(h),!this._model.selectionEnd)return void this.refresh(!0);this._activeSelectionMode===2?this._model.selectionEnd[1]<this._model.selectionStart[1]?this._model.selectionEnd[0]=0:this._model.selectionEnd[0]=this._bufferService.cols:this._activeSelectionMode===1&&this._selectToWordAt(this._model.selectionEnd),this._dragScrollAmount=this._getMouseEventScrollAmount(h),this._activeSelectionMode!==3&&(this._dragScrollAmount>0?this._model.selectionEnd[0]=this._bufferService.cols:this._dragScrollAmount<0&&(this._model.selectionEnd[0]=0));let b=this._bufferService.buffer;if(this._model.selectionEnd[1]<b.lines.length){let L=b.lines.get(this._model.selectionEnd[1]);L&&L.hasWidth(this._model.selectionEnd[0])===0&&this._model.selectionEnd[0]++}g&&g[0]===this._model.selectionEnd[0]&&g[1]===this._model.selectionEnd[1]||this.refresh(!0)}_dragScroll(){if(this._model.selectionEnd&&this._model.selectionStart&&this._dragScrollAmount){this._onRequestScrollLines.fire({amount:this._dragScrollAmount,suppressScrollEvent:!1});let h=this._bufferService.buffer;this._dragScrollAmount>0?(this._activeSelectionMode!==3&&(this._model.selectionEnd[0]=this._bufferService.cols),this._model.selectionEnd[1]=Math.min(h.ydisp+this._bufferService.rows,h.lines.length-1)):(this._activeSelectionMode!==3&&(this._model.selectionEnd[0]=0),this._model.selectionEnd[1]=h.ydisp),this.refresh()}}_handleMouseUp(h){let g=h.timeStamp-this._mouseDownTimeStamp;if(this._removeMouseDownListeners(),this.selectionText.length<=1&&g<500&&h.altKey&&this._optionsService.rawOptions.altClickMovesCursor){if(this._bufferService.buffer.ybase===this._bufferService.buffer.ydisp){let b=this._mouseService.getCoords(h,this._element,this._bufferService.cols,this._bufferService.rows,!1);if(b&&b[0]!==void 0&&b[1]!==void 0){let L=(0,d.moveToCellSequence)(b[0]-1,b[1]-1,this._bufferService,this._coreService.decPrivateModes.applicationCursorKeys);this._coreService.triggerDataEvent(L,!0)}}}else this._fireEventIfSelectionChanged()}_fireEventIfSelectionChanged(){let h=this._model.finalSelectionStart,g=this._model.finalSelectionEnd,b=!(!h||!g||h[0]===g[0]&&h[1]===g[1]);b?h&&g&&(this._oldSelectionStart&&this._oldSelectionEnd&&h[0]===this._oldSelectionStart[0]&&h[1]===this._oldSelectionStart[1]&&g[0]===this._oldSelectionEnd[0]&&g[1]===this._oldSelectionEnd[1]||this._fireOnSelectionChange(h,g,b)):this._oldHasSelection&&this._fireOnSelectionChange(h,g,b)}_fireOnSelectionChange(h,g,b){this._oldSelectionStart=h,this._oldSelectionEnd=g,this._oldHasSelection=b,this._onSelectionChange.fire()}_handleBufferActivate(h){this.clearSelection(),this._trimListener.dispose(),this._trimListener=h.activeBuffer.lines.onTrim((g=>this._handleTrim(g)))}_convertViewportColToCharacterIndex(h,g){let b=g;for(let L=0;g>=L;L++){let y=h.loadCell(L,this._workCell).getChars().length;this._workCell.getWidth()===0?b--:y>1&&g!==L&&(b+=y-1)}return b}setSelection(h,g,b){this._model.clearSelection(),this._removeMouseDownListeners(),this._model.selectionStart=[h,g],this._model.selectionStartLength=b,this.refresh(),this._fireEventIfSelectionChanged()}rightClickSelect(h){this._isClickInSelection(h)||(this._selectWordAtCursor(h,!1)&&this.refresh(!0),this._fireEventIfSelectionChanged())}_getWordAt(h,g,b=!0,L=!0){if(h[0]>=this._bufferService.cols)return;let y=this._bufferService.buffer,k=y.lines.get(h[1]);if(!k)return;let x=y.translateBufferLineToString(h[1],!1),T=this._convertViewportColToCharacterIndex(k,h[0]),P=T,M=h[0]-T,C=0,w=0,E=0,D=0;if(x.charAt(T)===" "){for(;T>0&&x.charAt(T-1)===" ";)T--;for(;P<x.length&&x.charAt(P+1)===" ";)P++}else{let U=h[0],W=h[0];k.getWidth(U)===0&&(C++,U--),k.getWidth(W)===2&&(w++,W++);let V=k.getString(W).length;for(V>1&&(D+=V-1,P+=V-1);U>0&&T>0&&!this._isCharWordSeparator(k.loadCell(U-1,this._workCell));){k.loadCell(U-1,this._workCell);let S=this._workCell.getChars().length;this._workCell.getWidth()===0?(C++,U--):S>1&&(E+=S-1,T-=S-1),T--,U--}for(;W<k.length&&P+1<x.length&&!this._isCharWordSeparator(k.loadCell(W+1,this._workCell));){k.loadCell(W+1,this._workCell);let S=this._workCell.getChars().length;this._workCell.getWidth()===2?(w++,W++):S>1&&(D+=S-1,P+=S-1),P++,W++}}P++;let I=T+M-C+E,H=Math.min(this._bufferService.cols,P-T+C+w-E-D);if(g||x.slice(T,P).trim()!==""){if(b&&I===0&&k.getCodePoint(0)!==32){let U=y.lines.get(h[1]-1);if(U&&k.isWrapped&&U.getCodePoint(this._bufferService.cols-1)!==32){let W=this._getWordAt([this._bufferService.cols-1,h[1]-1],!1,!0,!1);if(W){let V=this._bufferService.cols-W.start;I-=V,H+=V}}}if(L&&I+H===this._bufferService.cols&&k.getCodePoint(this._bufferService.cols-1)!==32){let U=y.lines.get(h[1]+1);if(U?.isWrapped&&U.getCodePoint(0)!==32){let W=this._getWordAt([0,h[1]+1],!1,!1,!0);W&&(H+=W.length)}}return{start:I,length:H}}}_selectWordAt(h,g){let b=this._getWordAt(h,g);if(b){for(;b.start<0;)b.start+=this._bufferService.cols,h[1]--;this._model.selectionStart=[b.start,h[1]],this._model.selectionStartLength=b.length}}_selectToWordAt(h){let g=this._getWordAt(h,!0);if(g){let b=h[1];for(;g.start<0;)g.start+=this._bufferService.cols,b--;if(!this._model.areSelectionValuesReversed())for(;g.start+g.length>this._bufferService.cols;)g.length-=this._bufferService.cols,b++;this._model.selectionEnd=[this._model.areSelectionValuesReversed()?g.start:g.start+g.length,b]}}_isCharWordSeparator(h){return h.getWidth()!==0&&this._optionsService.rawOptions.wordSeparator.indexOf(h.getChars())>=0}_selectLineAt(h){let g=this._bufferService.buffer.getWrappedRangeForLine(h),b={start:{x:0,y:g.first},end:{x:this._bufferService.cols-1,y:g.last}};this._model.selectionStart=[0,g.first],this._model.selectionEnd=void 0,this._model.selectionStartLength=(0,t.getRangeLength)(b,this._bufferService.cols)}};r.SelectionService=m=l([u(3,o.IBufferService),u(4,o.ICoreService),u(5,p.IMouseService),u(6,o.IOptionsService),u(7,p.IRenderService),u(8,p.ICoreBrowserService)],m)},4725:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.IThemeService=r.ICharacterJoinerService=r.ISelectionService=r.IRenderService=r.IMouseService=r.ICoreBrowserService=r.ICharSizeService=void 0;let l=a(8343);r.ICharSizeService=(0,l.createDecorator)("CharSizeService"),r.ICoreBrowserService=(0,l.createDecorator)("CoreBrowserService"),r.IMouseService=(0,l.createDecorator)("MouseService"),r.IRenderService=(0,l.createDecorator)("RenderService"),r.ISelectionService=(0,l.createDecorator)("SelectionService"),r.ICharacterJoinerService=(0,l.createDecorator)("CharacterJoinerService"),r.IThemeService=(0,l.createDecorator)("ThemeService")},6731:function(O,r,a){var l=this&&this.__decorate||function(m,h,g,b){var L,y=arguments.length,k=y<3?h:b===null?b=Object.getOwnPropertyDescriptor(h,g):b;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")k=Reflect.decorate(m,h,g,b);else for(var x=m.length-1;x>=0;x--)(L=m[x])&&(k=(y<3?L(k):y>3?L(h,g,k):L(h,g))||k);return y>3&&k&&Object.defineProperty(h,g,k),k},u=this&&this.__param||function(m,h){return function(g,b){h(g,b,m)}};Object.defineProperty(r,"__esModule",{value:!0}),r.ThemeService=r.DEFAULT_ANSI_COLORS=void 0;let n=a(7239),d=a(8055),f=a(8460),p=a(844),_=a(2585),e=d.css.toColor("#ffffff"),s=d.css.toColor("#000000"),t=d.css.toColor("#ffffff"),i=d.css.toColor("#000000"),o={css:"rgba(255, 255, 255, 0.3)",rgba:4294967117};r.DEFAULT_ANSI_COLORS=Object.freeze((()=>{let m=[d.css.toColor("#2e3436"),d.css.toColor("#cc0000"),d.css.toColor("#4e9a06"),d.css.toColor("#c4a000"),d.css.toColor("#3465a4"),d.css.toColor("#75507b"),d.css.toColor("#06989a"),d.css.toColor("#d3d7cf"),d.css.toColor("#555753"),d.css.toColor("#ef2929"),d.css.toColor("#8ae234"),d.css.toColor("#fce94f"),d.css.toColor("#729fcf"),d.css.toColor("#ad7fa8"),d.css.toColor("#34e2e2"),d.css.toColor("#eeeeec")],h=[0,95,135,175,215,255];for(let g=0;g<216;g++){let b=h[g/36%6|0],L=h[g/6%6|0],y=h[g%6];m.push({css:d.channels.toCss(b,L,y),rgba:d.channels.toRgba(b,L,y)})}for(let g=0;g<24;g++){let b=8+10*g;m.push({css:d.channels.toCss(b,b,b),rgba:d.channels.toRgba(b,b,b)})}return m})());let c=r.ThemeService=class extends p.Disposable{get colors(){return this._colors}constructor(m){super(),this._optionsService=m,this._contrastCache=new n.ColorContrastCache,this._halfContrastCache=new n.ColorContrastCache,this._onChangeColors=this.register(new f.EventEmitter),this.onChangeColors=this._onChangeColors.event,this._colors={foreground:e,background:s,cursor:t,cursorAccent:i,selectionForeground:void 0,selectionBackgroundTransparent:o,selectionBackgroundOpaque:d.color.blend(s,o),selectionInactiveBackgroundTransparent:o,selectionInactiveBackgroundOpaque:d.color.blend(s,o),ansi:r.DEFAULT_ANSI_COLORS.slice(),contrastCache:this._contrastCache,halfContrastCache:this._halfContrastCache},this._updateRestoreColors(),this._setTheme(this._optionsService.rawOptions.theme),this.register(this._optionsService.onSpecificOptionChange("minimumContrastRatio",(()=>this._contrastCache.clear()))),this.register(this._optionsService.onSpecificOptionChange("theme",(()=>this._setTheme(this._optionsService.rawOptions.theme))))}_setTheme(m={}){let h=this._colors;if(h.foreground=v(m.foreground,e),h.background=v(m.background,s),h.cursor=v(m.cursor,t),h.cursorAccent=v(m.cursorAccent,i),h.selectionBackgroundTransparent=v(m.selectionBackground,o),h.selectionBackgroundOpaque=d.color.blend(h.background,h.selectionBackgroundTransparent),h.selectionInactiveBackgroundTransparent=v(m.selectionInactiveBackground,h.selectionBackgroundTransparent),h.selectionInactiveBackgroundOpaque=d.color.blend(h.background,h.selectionInactiveBackgroundTransparent),h.selectionForeground=m.selectionForeground?v(m.selectionForeground,d.NULL_COLOR):void 0,h.selectionForeground===d.NULL_COLOR&&(h.selectionForeground=void 0),d.color.isOpaque(h.selectionBackgroundTransparent)&&(h.selectionBackgroundTransparent=d.color.opacity(h.selectionBackgroundTransparent,.3)),d.color.isOpaque(h.selectionInactiveBackgroundTransparent)&&(h.selectionInactiveBackgroundTransparent=d.color.opacity(h.selectionInactiveBackgroundTransparent,.3)),h.ansi=r.DEFAULT_ANSI_COLORS.slice(),h.ansi[0]=v(m.black,r.DEFAULT_ANSI_COLORS[0]),h.ansi[1]=v(m.red,r.DEFAULT_ANSI_COLORS[1]),h.ansi[2]=v(m.green,r.DEFAULT_ANSI_COLORS[2]),h.ansi[3]=v(m.yellow,r.DEFAULT_ANSI_COLORS[3]),h.ansi[4]=v(m.blue,r.DEFAULT_ANSI_COLORS[4]),h.ansi[5]=v(m.magenta,r.DEFAULT_ANSI_COLORS[5]),h.ansi[6]=v(m.cyan,r.DEFAULT_ANSI_COLORS[6]),h.ansi[7]=v(m.white,r.DEFAULT_ANSI_COLORS[7]),h.ansi[8]=v(m.brightBlack,r.DEFAULT_ANSI_COLORS[8]),h.ansi[9]=v(m.brightRed,r.DEFAULT_ANSI_COLORS[9]),h.ansi[10]=v(m.brightGreen,r.DEFAULT_ANSI_COLORS[10]),h.ansi[11]=v(m.brightYellow,r.DEFAULT_ANSI_COLORS[11]),h.ansi[12]=v(m.brightBlue,r.DEFAULT_ANSI_COLORS[12]),h.ansi[13]=v(m.brightMagenta,r.DEFAULT_ANSI_COLORS[13]),h.ansi[14]=v(m.brightCyan,r.DEFAULT_ANSI_COLORS[14]),h.ansi[15]=v(m.brightWhite,r.DEFAULT_ANSI_COLORS[15]),m.extendedAnsi){let g=Math.min(h.ansi.length-16,m.extendedAnsi.length);for(let b=0;b<g;b++)h.ansi[b+16]=v(m.extendedAnsi[b],r.DEFAULT_ANSI_COLORS[b+16])}this._contrastCache.clear(),this._halfContrastCache.clear(),this._updateRestoreColors(),this._onChangeColors.fire(this.colors)}restoreColor(m){this._restoreColor(m),this._onChangeColors.fire(this.colors)}_restoreColor(m){if(m!==void 0)switch(m){case 256:this._colors.foreground=this._restoreColors.foreground;break;case 257:this._colors.background=this._restoreColors.background;break;case 258:this._colors.cursor=this._restoreColors.cursor;break;default:this._colors.ansi[m]=this._restoreColors.ansi[m]}else for(let h=0;h<this._restoreColors.ansi.length;++h)this._colors.ansi[h]=this._restoreColors.ansi[h]}modifyColors(m){m(this._colors),this._onChangeColors.fire(this.colors)}_updateRestoreColors(){this._restoreColors={foreground:this._colors.foreground,background:this._colors.background,cursor:this._colors.cursor,ansi:this._colors.ansi.slice()}}};function v(m,h){if(m!==void 0)try{return d.css.toColor(m)}catch{}return h}r.ThemeService=c=l([u(0,_.IOptionsService)],c)},6349:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.CircularList=void 0;let l=a(8460),u=a(844);class n extends u.Disposable{constructor(f){super(),this._maxLength=f,this.onDeleteEmitter=this.register(new l.EventEmitter),this.onDelete=this.onDeleteEmitter.event,this.onInsertEmitter=this.register(new l.EventEmitter),this.onInsert=this.onInsertEmitter.event,this.onTrimEmitter=this.register(new l.EventEmitter),this.onTrim=this.onTrimEmitter.event,this._array=new Array(this._maxLength),this._startIndex=0,this._length=0}get maxLength(){return this._maxLength}set maxLength(f){if(this._maxLength===f)return;let p=new Array(f);for(let _=0;_<Math.min(f,this.length);_++)p[_]=this._array[this._getCyclicIndex(_)];this._array=p,this._maxLength=f,this._startIndex=0}get length(){return this._length}set length(f){if(f>this._length)for(let p=this._length;p<f;p++)this._array[p]=void 0;this._length=f}get(f){return this._array[this._getCyclicIndex(f)]}set(f,p){this._array[this._getCyclicIndex(f)]=p}push(f){this._array[this._getCyclicIndex(this._length)]=f,this._length===this._maxLength?(this._startIndex=++this._startIndex%this._maxLength,this.onTrimEmitter.fire(1)):this._length++}recycle(){if(this._length!==this._maxLength)throw new Error("Can only recycle when the buffer is full");return this._startIndex=++this._startIndex%this._maxLength,this.onTrimEmitter.fire(1),this._array[this._getCyclicIndex(this._length-1)]}get isFull(){return this._length===this._maxLength}pop(){return this._array[this._getCyclicIndex(this._length---1)]}splice(f,p,..._){if(p){for(let e=f;e<this._length-p;e++)this._array[this._getCyclicIndex(e)]=this._array[this._getCyclicIndex(e+p)];this._length-=p,this.onDeleteEmitter.fire({index:f,amount:p})}for(let e=this._length-1;e>=f;e--)this._array[this._getCyclicIndex(e+_.length)]=this._array[this._getCyclicIndex(e)];for(let e=0;e<_.length;e++)this._array[this._getCyclicIndex(f+e)]=_[e];if(_.length&&this.onInsertEmitter.fire({index:f,amount:_.length}),this._length+_.length>this._maxLength){let e=this._length+_.length-this._maxLength;this._startIndex+=e,this._length=this._maxLength,this.onTrimEmitter.fire(e)}else this._length+=_.length}trimStart(f){f>this._length&&(f=this._length),this._startIndex+=f,this._length-=f,this.onTrimEmitter.fire(f)}shiftElements(f,p,_){if(!(p<=0)){if(f<0||f>=this._length)throw new Error("start argument out of range");if(f+_<0)throw new Error("Cannot shift elements in list beyond index 0");if(_>0){for(let s=p-1;s>=0;s--)this.set(f+s+_,this.get(f+s));let e=f+p+_-this._length;if(e>0)for(this._length+=e;this._length>this._maxLength;)this._length--,this._startIndex++,this.onTrimEmitter.fire(1)}else for(let e=0;e<p;e++)this.set(f+e+_,this.get(f+e))}}_getCyclicIndex(f){return(this._startIndex+f)%this._maxLength}}r.CircularList=n},1439:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.clone=void 0,r.clone=function a(l,u=5){if(typeof l!="object")return l;let n=Array.isArray(l)?[]:{};for(let d in l)n[d]=u<=1?l[d]:l[d]&&a(l[d],u-1);return n}},8055:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.contrastRatio=r.toPaddedHex=r.rgba=r.rgb=r.css=r.color=r.channels=r.NULL_COLOR=void 0;let l=a(6114),u=0,n=0,d=0,f=0;var p,_,e,s,t;function i(c){let v=c.toString(16);return v.length<2?"0"+v:v}function o(c,v){return c<v?(v+.05)/(c+.05):(c+.05)/(v+.05)}r.NULL_COLOR={css:"#00000000",rgba:0},(function(c){c.toCss=function(v,m,h,g){return g!==void 0?`#${i(v)}${i(m)}${i(h)}${i(g)}`:`#${i(v)}${i(m)}${i(h)}`},c.toRgba=function(v,m,h,g=255){return(v<<24|m<<16|h<<8|g)>>>0}})(p||(r.channels=p={})),(function(c){function v(m,h){return f=Math.round(255*h),[u,n,d]=t.toChannels(m.rgba),{css:p.toCss(u,n,d,f),rgba:p.toRgba(u,n,d,f)}}c.blend=function(m,h){if(f=(255&h.rgba)/255,f===1)return{css:h.css,rgba:h.rgba};let g=h.rgba>>24&255,b=h.rgba>>16&255,L=h.rgba>>8&255,y=m.rgba>>24&255,k=m.rgba>>16&255,x=m.rgba>>8&255;return u=y+Math.round((g-y)*f),n=k+Math.round((b-k)*f),d=x+Math.round((L-x)*f),{css:p.toCss(u,n,d),rgba:p.toRgba(u,n,d)}},c.isOpaque=function(m){return(255&m.rgba)==255},c.ensureContrastRatio=function(m,h,g){let b=t.ensureContrastRatio(m.rgba,h.rgba,g);if(b)return t.toColor(b>>24&255,b>>16&255,b>>8&255)},c.opaque=function(m){let h=(255|m.rgba)>>>0;return[u,n,d]=t.toChannels(h),{css:p.toCss(u,n,d),rgba:h}},c.opacity=v,c.multiplyOpacity=function(m,h){return f=255&m.rgba,v(m,f*h/255)},c.toColorRGB=function(m){return[m.rgba>>24&255,m.rgba>>16&255,m.rgba>>8&255]}})(_||(r.color=_={})),(function(c){let v,m;if(!l.isNode){let h=document.createElement("canvas");h.width=1,h.height=1;let g=h.getContext("2d",{willReadFrequently:!0});g&&(v=g,v.globalCompositeOperation="copy",m=v.createLinearGradient(0,0,1,1))}c.toColor=function(h){if(h.match(/#[\da-f]{3,8}/i))switch(h.length){case 4:return u=parseInt(h.slice(1,2).repeat(2),16),n=parseInt(h.slice(2,3).repeat(2),16),d=parseInt(h.slice(3,4).repeat(2),16),t.toColor(u,n,d);case 5:return u=parseInt(h.slice(1,2).repeat(2),16),n=parseInt(h.slice(2,3).repeat(2),16),d=parseInt(h.slice(3,4).repeat(2),16),f=parseInt(h.slice(4,5).repeat(2),16),t.toColor(u,n,d,f);case 7:return{css:h,rgba:(parseInt(h.slice(1),16)<<8|255)>>>0};case 9:return{css:h,rgba:parseInt(h.slice(1),16)>>>0}}let g=h.match(/rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(,\s*(0|1|\d?\.(\d+))\s*)?\)/);if(g)return u=parseInt(g[1]),n=parseInt(g[2]),d=parseInt(g[3]),f=Math.round(255*(g[5]===void 0?1:parseFloat(g[5]))),t.toColor(u,n,d,f);if(!v||!m)throw new Error("css.toColor: Unsupported css format");if(v.fillStyle=m,v.fillStyle=h,typeof v.fillStyle!="string")throw new Error("css.toColor: Unsupported css format");if(v.fillRect(0,0,1,1),[u,n,d,f]=v.getImageData(0,0,1,1).data,f!==255)throw new Error("css.toColor: Unsupported css format");return{rgba:p.toRgba(u,n,d,f),css:h}}})(e||(r.css=e={})),(function(c){function v(m,h,g){let b=m/255,L=h/255,y=g/255;return .2126*(b<=.03928?b/12.92:Math.pow((b+.055)/1.055,2.4))+.7152*(L<=.03928?L/12.92:Math.pow((L+.055)/1.055,2.4))+.0722*(y<=.03928?y/12.92:Math.pow((y+.055)/1.055,2.4))}c.relativeLuminance=function(m){return v(m>>16&255,m>>8&255,255&m)},c.relativeLuminance2=v})(s||(r.rgb=s={})),(function(c){function v(h,g,b){let L=h>>24&255,y=h>>16&255,k=h>>8&255,x=g>>24&255,T=g>>16&255,P=g>>8&255,M=o(s.relativeLuminance2(x,T,P),s.relativeLuminance2(L,y,k));for(;M<b&&(x>0||T>0||P>0);)x-=Math.max(0,Math.ceil(.1*x)),T-=Math.max(0,Math.ceil(.1*T)),P-=Math.max(0,Math.ceil(.1*P)),M=o(s.relativeLuminance2(x,T,P),s.relativeLuminance2(L,y,k));return(x<<24|T<<16|P<<8|255)>>>0}function m(h,g,b){let L=h>>24&255,y=h>>16&255,k=h>>8&255,x=g>>24&255,T=g>>16&255,P=g>>8&255,M=o(s.relativeLuminance2(x,T,P),s.relativeLuminance2(L,y,k));for(;M<b&&(x<255||T<255||P<255);)x=Math.min(255,x+Math.ceil(.1*(255-x))),T=Math.min(255,T+Math.ceil(.1*(255-T))),P=Math.min(255,P+Math.ceil(.1*(255-P))),M=o(s.relativeLuminance2(x,T,P),s.relativeLuminance2(L,y,k));return(x<<24|T<<16|P<<8|255)>>>0}c.ensureContrastRatio=function(h,g,b){let L=s.relativeLuminance(h>>8),y=s.relativeLuminance(g>>8);if(o(L,y)<b){if(y<L){let T=v(h,g,b),P=o(L,s.relativeLuminance(T>>8));if(P<b){let M=m(h,g,b);return P>o(L,s.relativeLuminance(M>>8))?T:M}return T}let k=m(h,g,b),x=o(L,s.relativeLuminance(k>>8));if(x<b){let T=v(h,g,b);return x>o(L,s.relativeLuminance(T>>8))?k:T}return k}},c.reduceLuminance=v,c.increaseLuminance=m,c.toChannels=function(h){return[h>>24&255,h>>16&255,h>>8&255,255&h]},c.toColor=function(h,g,b,L){return{css:p.toCss(h,g,b,L),rgba:p.toRgba(h,g,b,L)}}})(t||(r.rgba=t={})),r.toPaddedHex=i,r.contrastRatio=o},8969:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.CoreTerminal=void 0;let l=a(844),u=a(2585),n=a(4348),d=a(7866),f=a(744),p=a(7302),_=a(6975),e=a(8460),s=a(1753),t=a(1480),i=a(7994),o=a(9282),c=a(5435),v=a(5981),m=a(2660),h=!1;class g extends l.Disposable{get onScroll(){return this._onScrollApi||(this._onScrollApi=this.register(new e.EventEmitter),this._onScroll.event((L=>{var y;(y=this._onScrollApi)===null||y===void 0||y.fire(L.position)}))),this._onScrollApi.event}get cols(){return this._bufferService.cols}get rows(){return this._bufferService.rows}get buffers(){return this._bufferService.buffers}get options(){return this.optionsService.options}set options(L){for(let y in L)this.optionsService.options[y]=L[y]}constructor(L){super(),this._windowsWrappingHeuristics=this.register(new l.MutableDisposable),this._onBinary=this.register(new e.EventEmitter),this.onBinary=this._onBinary.event,this._onData=this.register(new e.EventEmitter),this.onData=this._onData.event,this._onLineFeed=this.register(new e.EventEmitter),this.onLineFeed=this._onLineFeed.event,this._onResize=this.register(new e.EventEmitter),this.onResize=this._onResize.event,this._onWriteParsed=this.register(new e.EventEmitter),this.onWriteParsed=this._onWriteParsed.event,this._onScroll=this.register(new e.EventEmitter),this._instantiationService=new n.InstantiationService,this.optionsService=this.register(new p.OptionsService(L)),this._instantiationService.setService(u.IOptionsService,this.optionsService),this._bufferService=this.register(this._instantiationService.createInstance(f.BufferService)),this._instantiationService.setService(u.IBufferService,this._bufferService),this._logService=this.register(this._instantiationService.createInstance(d.LogService)),this._instantiationService.setService(u.ILogService,this._logService),this.coreService=this.register(this._instantiationService.createInstance(_.CoreService)),this._instantiationService.setService(u.ICoreService,this.coreService),this.coreMouseService=this.register(this._instantiationService.createInstance(s.CoreMouseService)),this._instantiationService.setService(u.ICoreMouseService,this.coreMouseService),this.unicodeService=this.register(this._instantiationService.createInstance(t.UnicodeService)),this._instantiationService.setService(u.IUnicodeService,this.unicodeService),this._charsetService=this._instantiationService.createInstance(i.CharsetService),this._instantiationService.setService(u.ICharsetService,this._charsetService),this._oscLinkService=this._instantiationService.createInstance(m.OscLinkService),this._instantiationService.setService(u.IOscLinkService,this._oscLinkService),this._inputHandler=this.register(new c.InputHandler(this._bufferService,this._charsetService,this.coreService,this._logService,this.optionsService,this._oscLinkService,this.coreMouseService,this.unicodeService)),this.register((0,e.forwardEvent)(this._inputHandler.onLineFeed,this._onLineFeed)),this.register(this._inputHandler),this.register((0,e.forwardEvent)(this._bufferService.onResize,this._onResize)),this.register((0,e.forwardEvent)(this.coreService.onData,this._onData)),this.register((0,e.forwardEvent)(this.coreService.onBinary,this._onBinary)),this.register(this.coreService.onRequestScrollToBottom((()=>this.scrollToBottom()))),this.register(this.coreService.onUserInput((()=>this._writeBuffer.handleUserInput()))),this.register(this.optionsService.onMultipleOptionChange(["windowsMode","windowsPty"],(()=>this._handleWindowsPtyOptionChange()))),this.register(this._bufferService.onScroll((y=>{this._onScroll.fire({position:this._bufferService.buffer.ydisp,source:0}),this._inputHandler.markRangeDirty(this._bufferService.buffer.scrollTop,this._bufferService.buffer.scrollBottom)}))),this.register(this._inputHandler.onScroll((y=>{this._onScroll.fire({position:this._bufferService.buffer.ydisp,source:0}),this._inputHandler.markRangeDirty(this._bufferService.buffer.scrollTop,this._bufferService.buffer.scrollBottom)}))),this._writeBuffer=this.register(new v.WriteBuffer(((y,k)=>this._inputHandler.parse(y,k)))),this.register((0,e.forwardEvent)(this._writeBuffer.onWriteParsed,this._onWriteParsed))}write(L,y){this._writeBuffer.write(L,y)}writeSync(L,y){this._logService.logLevel<=u.LogLevelEnum.WARN&&!h&&(this._logService.warn("writeSync is unreliable and will be removed soon."),h=!0),this._writeBuffer.writeSync(L,y)}resize(L,y){isNaN(L)||isNaN(y)||(L=Math.max(L,f.MINIMUM_COLS),y=Math.max(y,f.MINIMUM_ROWS),this._bufferService.resize(L,y))}scroll(L,y=!1){this._bufferService.scroll(L,y)}scrollLines(L,y,k){this._bufferService.scrollLines(L,y,k)}scrollPages(L){this.scrollLines(L*(this.rows-1))}scrollToTop(){this.scrollLines(-this._bufferService.buffer.ydisp)}scrollToBottom(){this.scrollLines(this._bufferService.buffer.ybase-this._bufferService.buffer.ydisp)}scrollToLine(L){let y=L-this._bufferService.buffer.ydisp;y!==0&&this.scrollLines(y)}registerEscHandler(L,y){return this._inputHandler.registerEscHandler(L,y)}registerDcsHandler(L,y){return this._inputHandler.registerDcsHandler(L,y)}registerCsiHandler(L,y){return this._inputHandler.registerCsiHandler(L,y)}registerOscHandler(L,y){return this._inputHandler.registerOscHandler(L,y)}_setup(){this._handleWindowsPtyOptionChange()}reset(){this._inputHandler.reset(),this._bufferService.reset(),this._charsetService.reset(),this.coreService.reset(),this.coreMouseService.reset()}_handleWindowsPtyOptionChange(){let L=!1,y=this.optionsService.rawOptions.windowsPty;y&&y.buildNumber!==void 0&&y.buildNumber!==void 0?L=y.backend==="conpty"&&y.buildNumber<21376:this.optionsService.rawOptions.windowsMode&&(L=!0),L?this._enableWindowsWrappingHeuristics():this._windowsWrappingHeuristics.clear()}_enableWindowsWrappingHeuristics(){if(!this._windowsWrappingHeuristics.value){let L=[];L.push(this.onLineFeed(o.updateWindowsModeWrappedState.bind(null,this._bufferService))),L.push(this.registerCsiHandler({final:"H"},(()=>((0,o.updateWindowsModeWrappedState)(this._bufferService),!1)))),this._windowsWrappingHeuristics.value=(0,l.toDisposable)((()=>{for(let y of L)y.dispose()}))}}}r.CoreTerminal=g},8460:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.forwardEvent=r.EventEmitter=void 0,r.EventEmitter=class{constructor(){this._listeners=[],this._disposed=!1}get event(){return this._event||(this._event=a=>(this._listeners.push(a),{dispose:()=>{if(!this._disposed){for(let l=0;l<this._listeners.length;l++)if(this._listeners[l]===a)return void this._listeners.splice(l,1)}}})),this._event}fire(a,l){let u=[];for(let n=0;n<this._listeners.length;n++)u.push(this._listeners[n]);for(let n=0;n<u.length;n++)u[n].call(void 0,a,l)}dispose(){this.clearListeners(),this._disposed=!0}clearListeners(){this._listeners&&(this._listeners.length=0)}},r.forwardEvent=function(a,l){return a((u=>l.fire(u)))}},5435:function(O,r,a){var l=this&&this.__decorate||function(M,C,w,E){var D,I=arguments.length,H=I<3?C:E===null?E=Object.getOwnPropertyDescriptor(C,w):E;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")H=Reflect.decorate(M,C,w,E);else for(var U=M.length-1;U>=0;U--)(D=M[U])&&(H=(I<3?D(H):I>3?D(C,w,H):D(C,w))||H);return I>3&&H&&Object.defineProperty(C,w,H),H},u=this&&this.__param||function(M,C){return function(w,E){C(w,E,M)}};Object.defineProperty(r,"__esModule",{value:!0}),r.InputHandler=r.WindowsOptionsReportType=void 0;let n=a(2584),d=a(7116),f=a(2015),p=a(844),_=a(482),e=a(8437),s=a(8460),t=a(643),i=a(511),o=a(3734),c=a(2585),v=a(6242),m=a(6351),h=a(5941),g={"(":0,")":1,"*":2,"+":3,"-":1,".":2},b=131072;function L(M,C){if(M>24)return C.setWinLines||!1;switch(M){case 1:return!!C.restoreWin;case 2:return!!C.minimizeWin;case 3:return!!C.setWinPosition;case 4:return!!C.setWinSizePixels;case 5:return!!C.raiseWin;case 6:return!!C.lowerWin;case 7:return!!C.refreshWin;case 8:return!!C.setWinSizeChars;case 9:return!!C.maximizeWin;case 10:return!!C.fullscreenWin;case 11:return!!C.getWinState;case 13:return!!C.getWinPosition;case 14:return!!C.getWinSizePixels;case 15:return!!C.getScreenSizePixels;case 16:return!!C.getCellSizePixels;case 18:return!!C.getWinSizeChars;case 19:return!!C.getScreenSizeChars;case 20:return!!C.getIconTitle;case 21:return!!C.getWinTitle;case 22:return!!C.pushTitle;case 23:return!!C.popTitle;case 24:return!!C.setWinLines}return!1}var y;(function(M){M[M.GET_WIN_SIZE_PIXELS=0]="GET_WIN_SIZE_PIXELS",M[M.GET_CELL_SIZE_PIXELS=1]="GET_CELL_SIZE_PIXELS"})(y||(r.WindowsOptionsReportType=y={}));let k=0;class x extends p.Disposable{getAttrData(){return this._curAttrData}constructor(C,w,E,D,I,H,U,W,V=new f.EscapeSequenceParser){super(),this._bufferService=C,this._charsetService=w,this._coreService=E,this._logService=D,this._optionsService=I,this._oscLinkService=H,this._coreMouseService=U,this._unicodeService=W,this._parser=V,this._parseBuffer=new Uint32Array(4096),this._stringDecoder=new _.StringToUtf32,this._utf8Decoder=new _.Utf8ToUtf32,this._workCell=new i.CellData,this._windowTitle="",this._iconName="",this._windowTitleStack=[],this._iconNameStack=[],this._curAttrData=e.DEFAULT_ATTR_DATA.clone(),this._eraseAttrDataInternal=e.DEFAULT_ATTR_DATA.clone(),this._onRequestBell=this.register(new s.EventEmitter),this.onRequestBell=this._onRequestBell.event,this._onRequestRefreshRows=this.register(new s.EventEmitter),this.onRequestRefreshRows=this._onRequestRefreshRows.event,this._onRequestReset=this.register(new s.EventEmitter),this.onRequestReset=this._onRequestReset.event,this._onRequestSendFocus=this.register(new s.EventEmitter),this.onRequestSendFocus=this._onRequestSendFocus.event,this._onRequestSyncScrollBar=this.register(new s.EventEmitter),this.onRequestSyncScrollBar=this._onRequestSyncScrollBar.event,this._onRequestWindowsOptionsReport=this.register(new s.EventEmitter),this.onRequestWindowsOptionsReport=this._onRequestWindowsOptionsReport.event,this._onA11yChar=this.register(new s.EventEmitter),this.onA11yChar=this._onA11yChar.event,this._onA11yTab=this.register(new s.EventEmitter),this.onA11yTab=this._onA11yTab.event,this._onCursorMove=this.register(new s.EventEmitter),this.onCursorMove=this._onCursorMove.event,this._onLineFeed=this.register(new s.EventEmitter),this.onLineFeed=this._onLineFeed.event,this._onScroll=this.register(new s.EventEmitter),this.onScroll=this._onScroll.event,this._onTitleChange=this.register(new s.EventEmitter),this.onTitleChange=this._onTitleChange.event,this._onColor=this.register(new s.EventEmitter),this.onColor=this._onColor.event,this._parseStack={paused:!1,cursorStartX:0,cursorStartY:0,decodedLength:0,position:0},this._specialColors=[256,257,258],this.register(this._parser),this._dirtyRowTracker=new T(this._bufferService),this._activeBuffer=this._bufferService.buffer,this.register(this._bufferService.buffers.onBufferActivate((S=>this._activeBuffer=S.activeBuffer))),this._parser.setCsiHandlerFallback(((S,R)=>{this._logService.debug("Unknown CSI code: ",{identifier:this._parser.identToString(S),params:R.toArray()})})),this._parser.setEscHandlerFallback((S=>{this._logService.debug("Unknown ESC code: ",{identifier:this._parser.identToString(S)})})),this._parser.setExecuteHandlerFallback((S=>{this._logService.debug("Unknown EXECUTE code: ",{code:S})})),this._parser.setOscHandlerFallback(((S,R,B)=>{this._logService.debug("Unknown OSC code: ",{identifier:S,action:R,data:B})})),this._parser.setDcsHandlerFallback(((S,R,B)=>{R==="HOOK"&&(B=B.toArray()),this._logService.debug("Unknown DCS code: ",{identifier:this._parser.identToString(S),action:R,payload:B})})),this._parser.setPrintHandler(((S,R,B)=>this.print(S,R,B))),this._parser.registerCsiHandler({final:"@"},(S=>this.insertChars(S))),this._parser.registerCsiHandler({intermediates:" ",final:"@"},(S=>this.scrollLeft(S))),this._parser.registerCsiHandler({final:"A"},(S=>this.cursorUp(S))),this._parser.registerCsiHandler({intermediates:" ",final:"A"},(S=>this.scrollRight(S))),this._parser.registerCsiHandler({final:"B"},(S=>this.cursorDown(S))),this._parser.registerCsiHandler({final:"C"},(S=>this.cursorForward(S))),this._parser.registerCsiHandler({final:"D"},(S=>this.cursorBackward(S))),this._parser.registerCsiHandler({final:"E"},(S=>this.cursorNextLine(S))),this._parser.registerCsiHandler({final:"F"},(S=>this.cursorPrecedingLine(S))),this._parser.registerCsiHandler({final:"G"},(S=>this.cursorCharAbsolute(S))),this._parser.registerCsiHandler({final:"H"},(S=>this.cursorPosition(S))),this._parser.registerCsiHandler({final:"I"},(S=>this.cursorForwardTab(S))),this._parser.registerCsiHandler({final:"J"},(S=>this.eraseInDisplay(S,!1))),this._parser.registerCsiHandler({prefix:"?",final:"J"},(S=>this.eraseInDisplay(S,!0))),this._parser.registerCsiHandler({final:"K"},(S=>this.eraseInLine(S,!1))),this._parser.registerCsiHandler({prefix:"?",final:"K"},(S=>this.eraseInLine(S,!0))),this._parser.registerCsiHandler({final:"L"},(S=>this.insertLines(S))),this._parser.registerCsiHandler({final:"M"},(S=>this.deleteLines(S))),this._parser.registerCsiHandler({final:"P"},(S=>this.deleteChars(S))),this._parser.registerCsiHandler({final:"S"},(S=>this.scrollUp(S))),this._parser.registerCsiHandler({final:"T"},(S=>this.scrollDown(S))),this._parser.registerCsiHandler({final:"X"},(S=>this.eraseChars(S))),this._parser.registerCsiHandler({final:"Z"},(S=>this.cursorBackwardTab(S))),this._parser.registerCsiHandler({final:"`"},(S=>this.charPosAbsolute(S))),this._parser.registerCsiHandler({final:"a"},(S=>this.hPositionRelative(S))),this._parser.registerCsiHandler({final:"b"},(S=>this.repeatPrecedingCharacter(S))),this._parser.registerCsiHandler({final:"c"},(S=>this.sendDeviceAttributesPrimary(S))),this._parser.registerCsiHandler({prefix:">",final:"c"},(S=>this.sendDeviceAttributesSecondary(S))),this._parser.registerCsiHandler({final:"d"},(S=>this.linePosAbsolute(S))),this._parser.registerCsiHandler({final:"e"},(S=>this.vPositionRelative(S))),this._parser.registerCsiHandler({final:"f"},(S=>this.hVPosition(S))),this._parser.registerCsiHandler({final:"g"},(S=>this.tabClear(S))),this._parser.registerCsiHandler({final:"h"},(S=>this.setMode(S))),this._parser.registerCsiHandler({prefix:"?",final:"h"},(S=>this.setModePrivate(S))),this._parser.registerCsiHandler({final:"l"},(S=>this.resetMode(S))),this._parser.registerCsiHandler({prefix:"?",final:"l"},(S=>this.resetModePrivate(S))),this._parser.registerCsiHandler({final:"m"},(S=>this.charAttributes(S))),this._parser.registerCsiHandler({final:"n"},(S=>this.deviceStatus(S))),this._parser.registerCsiHandler({prefix:"?",final:"n"},(S=>this.deviceStatusPrivate(S))),this._parser.registerCsiHandler({intermediates:"!",final:"p"},(S=>this.softReset(S))),this._parser.registerCsiHandler({intermediates:" ",final:"q"},(S=>this.setCursorStyle(S))),this._parser.registerCsiHandler({final:"r"},(S=>this.setScrollRegion(S))),this._parser.registerCsiHandler({final:"s"},(S=>this.saveCursor(S))),this._parser.registerCsiHandler({final:"t"},(S=>this.windowOptions(S))),this._parser.registerCsiHandler({final:"u"},(S=>this.restoreCursor(S))),this._parser.registerCsiHandler({intermediates:"'",final:"}"},(S=>this.insertColumns(S))),this._parser.registerCsiHandler({intermediates:"'",final:"~"},(S=>this.deleteColumns(S))),this._parser.registerCsiHandler({intermediates:'"',final:"q"},(S=>this.selectProtected(S))),this._parser.registerCsiHandler({intermediates:"$",final:"p"},(S=>this.requestMode(S,!0))),this._parser.registerCsiHandler({prefix:"?",intermediates:"$",final:"p"},(S=>this.requestMode(S,!1))),this._parser.setExecuteHandler(n.C0.BEL,(()=>this.bell())),this._parser.setExecuteHandler(n.C0.LF,(()=>this.lineFeed())),this._parser.setExecuteHandler(n.C0.VT,(()=>this.lineFeed())),this._parser.setExecuteHandler(n.C0.FF,(()=>this.lineFeed())),this._parser.setExecuteHandler(n.C0.CR,(()=>this.carriageReturn())),this._parser.setExecuteHandler(n.C0.BS,(()=>this.backspace())),this._parser.setExecuteHandler(n.C0.HT,(()=>this.tab())),this._parser.setExecuteHandler(n.C0.SO,(()=>this.shiftOut())),this._parser.setExecuteHandler(n.C0.SI,(()=>this.shiftIn())),this._parser.setExecuteHandler(n.C1.IND,(()=>this.index())),this._parser.setExecuteHandler(n.C1.NEL,(()=>this.nextLine())),this._parser.setExecuteHandler(n.C1.HTS,(()=>this.tabSet())),this._parser.registerOscHandler(0,new v.OscHandler((S=>(this.setTitle(S),this.setIconName(S),!0)))),this._parser.registerOscHandler(1,new v.OscHandler((S=>this.setIconName(S)))),this._parser.registerOscHandler(2,new v.OscHandler((S=>this.setTitle(S)))),this._parser.registerOscHandler(4,new v.OscHandler((S=>this.setOrReportIndexedColor(S)))),this._parser.registerOscHandler(8,new v.OscHandler((S=>this.setHyperlink(S)))),this._parser.registerOscHandler(10,new v.OscHandler((S=>this.setOrReportFgColor(S)))),this._parser.registerOscHandler(11,new v.OscHandler((S=>this.setOrReportBgColor(S)))),this._parser.registerOscHandler(12,new v.OscHandler((S=>this.setOrReportCursorColor(S)))),this._parser.registerOscHandler(104,new v.OscHandler((S=>this.restoreIndexedColor(S)))),this._parser.registerOscHandler(110,new v.OscHandler((S=>this.restoreFgColor(S)))),this._parser.registerOscHandler(111,new v.OscHandler((S=>this.restoreBgColor(S)))),this._parser.registerOscHandler(112,new v.OscHandler((S=>this.restoreCursorColor(S)))),this._parser.registerEscHandler({final:"7"},(()=>this.saveCursor())),this._parser.registerEscHandler({final:"8"},(()=>this.restoreCursor())),this._parser.registerEscHandler({final:"D"},(()=>this.index())),this._parser.registerEscHandler({final:"E"},(()=>this.nextLine())),this._parser.registerEscHandler({final:"H"},(()=>this.tabSet())),this._parser.registerEscHandler({final:"M"},(()=>this.reverseIndex())),this._parser.registerEscHandler({final:"="},(()=>this.keypadApplicationMode())),this._parser.registerEscHandler({final:">"},(()=>this.keypadNumericMode())),this._parser.registerEscHandler({final:"c"},(()=>this.fullReset())),this._parser.registerEscHandler({final:"n"},(()=>this.setgLevel(2))),this._parser.registerEscHandler({final:"o"},(()=>this.setgLevel(3))),this._parser.registerEscHandler({final:"|"},(()=>this.setgLevel(3))),this._parser.registerEscHandler({final:"}"},(()=>this.setgLevel(2))),this._parser.registerEscHandler({final:"~"},(()=>this.setgLevel(1))),this._parser.registerEscHandler({intermediates:"%",final:"@"},(()=>this.selectDefaultCharset())),this._parser.registerEscHandler({intermediates:"%",final:"G"},(()=>this.selectDefaultCharset()));for(let S in d.CHARSETS)this._parser.registerEscHandler({intermediates:"(",final:S},(()=>this.selectCharset("("+S))),this._parser.registerEscHandler({intermediates:")",final:S},(()=>this.selectCharset(")"+S))),this._parser.registerEscHandler({intermediates:"*",final:S},(()=>this.selectCharset("*"+S))),this._parser.registerEscHandler({intermediates:"+",final:S},(()=>this.selectCharset("+"+S))),this._parser.registerEscHandler({intermediates:"-",final:S},(()=>this.selectCharset("-"+S))),this._parser.registerEscHandler({intermediates:".",final:S},(()=>this.selectCharset("."+S))),this._parser.registerEscHandler({intermediates:"/",final:S},(()=>this.selectCharset("/"+S)));this._parser.registerEscHandler({intermediates:"#",final:"8"},(()=>this.screenAlignmentPattern())),this._parser.setErrorHandler((S=>(this._logService.error("Parsing error: ",S),S))),this._parser.registerDcsHandler({intermediates:"$",final:"q"},new m.DcsHandler(((S,R)=>this.requestStatusString(S,R))))}_preserveStack(C,w,E,D){this._parseStack.paused=!0,this._parseStack.cursorStartX=C,this._parseStack.cursorStartY=w,this._parseStack.decodedLength=E,this._parseStack.position=D}_logSlowResolvingAsync(C){this._logService.logLevel<=c.LogLevelEnum.WARN&&Promise.race([C,new Promise(((w,E)=>setTimeout((()=>E("#SLOW_TIMEOUT")),5e3)))]).catch((w=>{if(w!=="#SLOW_TIMEOUT")throw w;console.warn("async parser handler taking longer than 5000 ms")}))}_getCurrentLinkId(){return this._curAttrData.extended.urlId}parse(C,w){let E,D=this._activeBuffer.x,I=this._activeBuffer.y,H=0,U=this._parseStack.paused;if(U){if(E=this._parser.parse(this._parseBuffer,this._parseStack.decodedLength,w))return this._logSlowResolvingAsync(E),E;D=this._parseStack.cursorStartX,I=this._parseStack.cursorStartY,this._parseStack.paused=!1,C.length>b&&(H=this._parseStack.position+b)}if(this._logService.logLevel<=c.LogLevelEnum.DEBUG&&this._logService.debug("parsing data"+(typeof C=="string"?` "${C}"`:` "${Array.prototype.map.call(C,(W=>String.fromCharCode(W))).join("")}"`),typeof C=="string"?C.split("").map((W=>W.charCodeAt(0))):C),this._parseBuffer.length<C.length&&this._parseBuffer.length<b&&(this._parseBuffer=new Uint32Array(Math.min(C.length,b))),U||this._dirtyRowTracker.clearRange(),C.length>b)for(let W=H;W<C.length;W+=b){let V=W+b<C.length?W+b:C.length,S=typeof C=="string"?this._stringDecoder.decode(C.substring(W,V),this._parseBuffer):this._utf8Decoder.decode(C.subarray(W,V),this._parseBuffer);if(E=this._parser.parse(this._parseBuffer,S))return this._preserveStack(D,I,S,W),this._logSlowResolvingAsync(E),E}else if(!U){let W=typeof C=="string"?this._stringDecoder.decode(C,this._parseBuffer):this._utf8Decoder.decode(C,this._parseBuffer);if(E=this._parser.parse(this._parseBuffer,W))return this._preserveStack(D,I,W,0),this._logSlowResolvingAsync(E),E}this._activeBuffer.x===D&&this._activeBuffer.y===I||this._onCursorMove.fire(),this._onRequestRefreshRows.fire(this._dirtyRowTracker.start,this._dirtyRowTracker.end)}print(C,w,E){let D,I,H=this._charsetService.charset,U=this._optionsService.rawOptions.screenReaderMode,W=this._bufferService.cols,V=this._coreService.decPrivateModes.wraparound,S=this._coreService.modes.insertMode,R=this._curAttrData,B=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._activeBuffer.x&&E-w>0&&B.getWidth(this._activeBuffer.x-1)===2&&B.setCellFromCodePoint(this._activeBuffer.x-1,0,1,R.fg,R.bg,R.extended);for(let A=w;A<E;++A){if(D=C[A],I=this._unicodeService.wcwidth(D),D<127&&H){let N=H[String.fromCharCode(D)];N&&(D=N.charCodeAt(0))}if(U&&this._onA11yChar.fire((0,_.stringFromCodePoint)(D)),this._getCurrentLinkId()&&this._oscLinkService.addLineToLink(this._getCurrentLinkId(),this._activeBuffer.ybase+this._activeBuffer.y),I||!this._activeBuffer.x){if(this._activeBuffer.x+I-1>=W){if(V){for(;this._activeBuffer.x<W;)B.setCellFromCodePoint(this._activeBuffer.x++,0,1,R.fg,R.bg,R.extended);this._activeBuffer.x=0,this._activeBuffer.y++,this._activeBuffer.y===this._activeBuffer.scrollBottom+1?(this._activeBuffer.y--,this._bufferService.scroll(this._eraseAttrData(),!0)):(this._activeBuffer.y>=this._bufferService.rows&&(this._activeBuffer.y=this._bufferService.rows-1),this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y).isWrapped=!0),B=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y)}else if(this._activeBuffer.x=W-1,I===2)continue}if(S&&(B.insertCells(this._activeBuffer.x,I,this._activeBuffer.getNullCell(R),R),B.getWidth(W-1)===2&&B.setCellFromCodePoint(W-1,t.NULL_CELL_CODE,t.NULL_CELL_WIDTH,R.fg,R.bg,R.extended)),B.setCellFromCodePoint(this._activeBuffer.x++,D,I,R.fg,R.bg,R.extended),I>0)for(;--I;)B.setCellFromCodePoint(this._activeBuffer.x++,0,0,R.fg,R.bg,R.extended)}else B.getWidth(this._activeBuffer.x-1)?B.addCodepointToCell(this._activeBuffer.x-1,D):B.addCodepointToCell(this._activeBuffer.x-2,D)}E-w>0&&(B.loadCell(this._activeBuffer.x-1,this._workCell),this._workCell.getWidth()===2||this._workCell.getCode()>65535?this._parser.precedingCodepoint=0:this._workCell.isCombined()?this._parser.precedingCodepoint=this._workCell.getChars().charCodeAt(0):this._parser.precedingCodepoint=this._workCell.content),this._activeBuffer.x<W&&E-w>0&&B.getWidth(this._activeBuffer.x)===0&&!B.hasContent(this._activeBuffer.x)&&B.setCellFromCodePoint(this._activeBuffer.x,0,1,R.fg,R.bg,R.extended),this._dirtyRowTracker.markDirty(this._activeBuffer.y)}registerCsiHandler(C,w){return C.final!=="t"||C.prefix||C.intermediates?this._parser.registerCsiHandler(C,w):this._parser.registerCsiHandler(C,(E=>!L(E.params[0],this._optionsService.rawOptions.windowOptions)||w(E)))}registerDcsHandler(C,w){return this._parser.registerDcsHandler(C,new m.DcsHandler(w))}registerEscHandler(C,w){return this._parser.registerEscHandler(C,w)}registerOscHandler(C,w){return this._parser.registerOscHandler(C,new v.OscHandler(w))}bell(){return this._onRequestBell.fire(),!0}lineFeed(){return this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._optionsService.rawOptions.convertEol&&(this._activeBuffer.x=0),this._activeBuffer.y++,this._activeBuffer.y===this._activeBuffer.scrollBottom+1?(this._activeBuffer.y--,this._bufferService.scroll(this._eraseAttrData())):this._activeBuffer.y>=this._bufferService.rows?this._activeBuffer.y=this._bufferService.rows-1:this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y).isWrapped=!1,this._activeBuffer.x>=this._bufferService.cols&&this._activeBuffer.x--,this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._onLineFeed.fire(),!0}carriageReturn(){return this._activeBuffer.x=0,!0}backspace(){var C;if(!this._coreService.decPrivateModes.reverseWraparound)return this._restrictCursor(),this._activeBuffer.x>0&&this._activeBuffer.x--,!0;if(this._restrictCursor(this._bufferService.cols),this._activeBuffer.x>0)this._activeBuffer.x--;else if(this._activeBuffer.x===0&&this._activeBuffer.y>this._activeBuffer.scrollTop&&this._activeBuffer.y<=this._activeBuffer.scrollBottom&&(!((C=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y))===null||C===void 0)&&C.isWrapped)){this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y).isWrapped=!1,this._activeBuffer.y--,this._activeBuffer.x=this._bufferService.cols-1;let w=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);w.hasWidth(this._activeBuffer.x)&&!w.hasContent(this._activeBuffer.x)&&this._activeBuffer.x--}return this._restrictCursor(),!0}tab(){if(this._activeBuffer.x>=this._bufferService.cols)return!0;let C=this._activeBuffer.x;return this._activeBuffer.x=this._activeBuffer.nextStop(),this._optionsService.rawOptions.screenReaderMode&&this._onA11yTab.fire(this._activeBuffer.x-C),!0}shiftOut(){return this._charsetService.setgLevel(1),!0}shiftIn(){return this._charsetService.setgLevel(0),!0}_restrictCursor(C=this._bufferService.cols-1){this._activeBuffer.x=Math.min(C,Math.max(0,this._activeBuffer.x)),this._activeBuffer.y=this._coreService.decPrivateModes.origin?Math.min(this._activeBuffer.scrollBottom,Math.max(this._activeBuffer.scrollTop,this._activeBuffer.y)):Math.min(this._bufferService.rows-1,Math.max(0,this._activeBuffer.y)),this._dirtyRowTracker.markDirty(this._activeBuffer.y)}_setCursor(C,w){this._dirtyRowTracker.markDirty(this._activeBuffer.y),this._coreService.decPrivateModes.origin?(this._activeBuffer.x=C,this._activeBuffer.y=this._activeBuffer.scrollTop+w):(this._activeBuffer.x=C,this._activeBuffer.y=w),this._restrictCursor(),this._dirtyRowTracker.markDirty(this._activeBuffer.y)}_moveCursor(C,w){this._restrictCursor(),this._setCursor(this._activeBuffer.x+C,this._activeBuffer.y+w)}cursorUp(C){let w=this._activeBuffer.y-this._activeBuffer.scrollTop;return w>=0?this._moveCursor(0,-Math.min(w,C.params[0]||1)):this._moveCursor(0,-(C.params[0]||1)),!0}cursorDown(C){let w=this._activeBuffer.scrollBottom-this._activeBuffer.y;return w>=0?this._moveCursor(0,Math.min(w,C.params[0]||1)):this._moveCursor(0,C.params[0]||1),!0}cursorForward(C){return this._moveCursor(C.params[0]||1,0),!0}cursorBackward(C){return this._moveCursor(-(C.params[0]||1),0),!0}cursorNextLine(C){return this.cursorDown(C),this._activeBuffer.x=0,!0}cursorPrecedingLine(C){return this.cursorUp(C),this._activeBuffer.x=0,!0}cursorCharAbsolute(C){return this._setCursor((C.params[0]||1)-1,this._activeBuffer.y),!0}cursorPosition(C){return this._setCursor(C.length>=2?(C.params[1]||1)-1:0,(C.params[0]||1)-1),!0}charPosAbsolute(C){return this._setCursor((C.params[0]||1)-1,this._activeBuffer.y),!0}hPositionRelative(C){return this._moveCursor(C.params[0]||1,0),!0}linePosAbsolute(C){return this._setCursor(this._activeBuffer.x,(C.params[0]||1)-1),!0}vPositionRelative(C){return this._moveCursor(0,C.params[0]||1),!0}hVPosition(C){return this.cursorPosition(C),!0}tabClear(C){let w=C.params[0];return w===0?delete this._activeBuffer.tabs[this._activeBuffer.x]:w===3&&(this._activeBuffer.tabs={}),!0}cursorForwardTab(C){if(this._activeBuffer.x>=this._bufferService.cols)return!0;let w=C.params[0]||1;for(;w--;)this._activeBuffer.x=this._activeBuffer.nextStop();return!0}cursorBackwardTab(C){if(this._activeBuffer.x>=this._bufferService.cols)return!0;let w=C.params[0]||1;for(;w--;)this._activeBuffer.x=this._activeBuffer.prevStop();return!0}selectProtected(C){let w=C.params[0];return w===1&&(this._curAttrData.bg|=536870912),w!==2&&w!==0||(this._curAttrData.bg&=-536870913),!0}_eraseInBufferLine(C,w,E,D=!1,I=!1){let H=this._activeBuffer.lines.get(this._activeBuffer.ybase+C);H.replaceCells(w,E,this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData(),I),D&&(H.isWrapped=!1)}_resetBufferLine(C,w=!1){let E=this._activeBuffer.lines.get(this._activeBuffer.ybase+C);E&&(E.fill(this._activeBuffer.getNullCell(this._eraseAttrData()),w),this._bufferService.buffer.clearMarkers(this._activeBuffer.ybase+C),E.isWrapped=!1)}eraseInDisplay(C,w=!1){let E;switch(this._restrictCursor(this._bufferService.cols),C.params[0]){case 0:for(E=this._activeBuffer.y,this._dirtyRowTracker.markDirty(E),this._eraseInBufferLine(E++,this._activeBuffer.x,this._bufferService.cols,this._activeBuffer.x===0,w);E<this._bufferService.rows;E++)this._resetBufferLine(E,w);this._dirtyRowTracker.markDirty(E);break;case 1:for(E=this._activeBuffer.y,this._dirtyRowTracker.markDirty(E),this._eraseInBufferLine(E,0,this._activeBuffer.x+1,!0,w),this._activeBuffer.x+1>=this._bufferService.cols&&(this._activeBuffer.lines.get(E+1).isWrapped=!1);E--;)this._resetBufferLine(E,w);this._dirtyRowTracker.markDirty(0);break;case 2:for(E=this._bufferService.rows,this._dirtyRowTracker.markDirty(E-1);E--;)this._resetBufferLine(E,w);this._dirtyRowTracker.markDirty(0);break;case 3:let D=this._activeBuffer.lines.length-this._bufferService.rows;D>0&&(this._activeBuffer.lines.trimStart(D),this._activeBuffer.ybase=Math.max(this._activeBuffer.ybase-D,0),this._activeBuffer.ydisp=Math.max(this._activeBuffer.ydisp-D,0),this._onScroll.fire(0))}return!0}eraseInLine(C,w=!1){switch(this._restrictCursor(this._bufferService.cols),C.params[0]){case 0:this._eraseInBufferLine(this._activeBuffer.y,this._activeBuffer.x,this._bufferService.cols,this._activeBuffer.x===0,w);break;case 1:this._eraseInBufferLine(this._activeBuffer.y,0,this._activeBuffer.x+1,!1,w);break;case 2:this._eraseInBufferLine(this._activeBuffer.y,0,this._bufferService.cols,!0,w)}return this._dirtyRowTracker.markDirty(this._activeBuffer.y),!0}insertLines(C){this._restrictCursor();let w=C.params[0]||1;if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;let E=this._activeBuffer.ybase+this._activeBuffer.y,D=this._bufferService.rows-1-this._activeBuffer.scrollBottom,I=this._bufferService.rows-1+this._activeBuffer.ybase-D+1;for(;w--;)this._activeBuffer.lines.splice(I-1,1),this._activeBuffer.lines.splice(E,0,this._activeBuffer.getBlankLine(this._eraseAttrData()));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y,this._activeBuffer.scrollBottom),this._activeBuffer.x=0,!0}deleteLines(C){this._restrictCursor();let w=C.params[0]||1;if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;let E=this._activeBuffer.ybase+this._activeBuffer.y,D;for(D=this._bufferService.rows-1-this._activeBuffer.scrollBottom,D=this._bufferService.rows-1+this._activeBuffer.ybase-D;w--;)this._activeBuffer.lines.splice(E,1),this._activeBuffer.lines.splice(D,0,this._activeBuffer.getBlankLine(this._eraseAttrData()));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.y,this._activeBuffer.scrollBottom),this._activeBuffer.x=0,!0}insertChars(C){this._restrictCursor();let w=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);return w&&(w.insertCells(this._activeBuffer.x,C.params[0]||1,this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData()),this._dirtyRowTracker.markDirty(this._activeBuffer.y)),!0}deleteChars(C){this._restrictCursor();let w=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);return w&&(w.deleteCells(this._activeBuffer.x,C.params[0]||1,this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData()),this._dirtyRowTracker.markDirty(this._activeBuffer.y)),!0}scrollUp(C){let w=C.params[0]||1;for(;w--;)this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollTop,1),this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollBottom,0,this._activeBuffer.getBlankLine(this._eraseAttrData()));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}scrollDown(C){let w=C.params[0]||1;for(;w--;)this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollBottom,1),this._activeBuffer.lines.splice(this._activeBuffer.ybase+this._activeBuffer.scrollTop,0,this._activeBuffer.getBlankLine(e.DEFAULT_ATTR_DATA));return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}scrollLeft(C){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;let w=C.params[0]||1;for(let E=this._activeBuffer.scrollTop;E<=this._activeBuffer.scrollBottom;++E){let D=this._activeBuffer.lines.get(this._activeBuffer.ybase+E);D.deleteCells(0,w,this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData()),D.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}scrollRight(C){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;let w=C.params[0]||1;for(let E=this._activeBuffer.scrollTop;E<=this._activeBuffer.scrollBottom;++E){let D=this._activeBuffer.lines.get(this._activeBuffer.ybase+E);D.insertCells(0,w,this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData()),D.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}insertColumns(C){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;let w=C.params[0]||1;for(let E=this._activeBuffer.scrollTop;E<=this._activeBuffer.scrollBottom;++E){let D=this._activeBuffer.lines.get(this._activeBuffer.ybase+E);D.insertCells(this._activeBuffer.x,w,this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData()),D.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}deleteColumns(C){if(this._activeBuffer.y>this._activeBuffer.scrollBottom||this._activeBuffer.y<this._activeBuffer.scrollTop)return!0;let w=C.params[0]||1;for(let E=this._activeBuffer.scrollTop;E<=this._activeBuffer.scrollBottom;++E){let D=this._activeBuffer.lines.get(this._activeBuffer.ybase+E);D.deleteCells(this._activeBuffer.x,w,this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData()),D.isWrapped=!1}return this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom),!0}eraseChars(C){this._restrictCursor();let w=this._activeBuffer.lines.get(this._activeBuffer.ybase+this._activeBuffer.y);return w&&(w.replaceCells(this._activeBuffer.x,this._activeBuffer.x+(C.params[0]||1),this._activeBuffer.getNullCell(this._eraseAttrData()),this._eraseAttrData()),this._dirtyRowTracker.markDirty(this._activeBuffer.y)),!0}repeatPrecedingCharacter(C){if(!this._parser.precedingCodepoint)return!0;let w=C.params[0]||1,E=new Uint32Array(w);for(let D=0;D<w;++D)E[D]=this._parser.precedingCodepoint;return this.print(E,0,E.length),!0}sendDeviceAttributesPrimary(C){return C.params[0]>0||(this._is("xterm")||this._is("rxvt-unicode")||this._is("screen")?this._coreService.triggerDataEvent(n.C0.ESC+"[?1;2c"):this._is("linux")&&this._coreService.triggerDataEvent(n.C0.ESC+"[?6c")),!0}sendDeviceAttributesSecondary(C){return C.params[0]>0||(this._is("xterm")?this._coreService.triggerDataEvent(n.C0.ESC+"[>0;276;0c"):this._is("rxvt-unicode")?this._coreService.triggerDataEvent(n.C0.ESC+"[>85;95;0c"):this._is("linux")?this._coreService.triggerDataEvent(C.params[0]+"c"):this._is("screen")&&this._coreService.triggerDataEvent(n.C0.ESC+"[>83;40003;0c")),!0}_is(C){return(this._optionsService.rawOptions.termName+"").indexOf(C)===0}setMode(C){for(let w=0;w<C.length;w++)switch(C.params[w]){case 4:this._coreService.modes.insertMode=!0;break;case 20:this._optionsService.options.convertEol=!0}return!0}setModePrivate(C){for(let w=0;w<C.length;w++)switch(C.params[w]){case 1:this._coreService.decPrivateModes.applicationCursorKeys=!0;break;case 2:this._charsetService.setgCharset(0,d.DEFAULT_CHARSET),this._charsetService.setgCharset(1,d.DEFAULT_CHARSET),this._charsetService.setgCharset(2,d.DEFAULT_CHARSET),this._charsetService.setgCharset(3,d.DEFAULT_CHARSET);break;case 3:this._optionsService.rawOptions.windowOptions.setWinLines&&(this._bufferService.resize(132,this._bufferService.rows),this._onRequestReset.fire());break;case 6:this._coreService.decPrivateModes.origin=!0,this._setCursor(0,0);break;case 7:this._coreService.decPrivateModes.wraparound=!0;break;case 12:this._optionsService.options.cursorBlink=!0;break;case 45:this._coreService.decPrivateModes.reverseWraparound=!0;break;case 66:this._logService.debug("Serial port requested application keypad."),this._coreService.decPrivateModes.applicationKeypad=!0,this._onRequestSyncScrollBar.fire();break;case 9:this._coreMouseService.activeProtocol="X10";break;case 1e3:this._coreMouseService.activeProtocol="VT200";break;case 1002:this._coreMouseService.activeProtocol="DRAG";break;case 1003:this._coreMouseService.activeProtocol="ANY";break;case 1004:this._coreService.decPrivateModes.sendFocus=!0,this._onRequestSendFocus.fire();break;case 1005:this._logService.debug("DECSET 1005 not supported (see #2507)");break;case 1006:this._coreMouseService.activeEncoding="SGR";break;case 1015:this._logService.debug("DECSET 1015 not supported (see #2507)");break;case 1016:this._coreMouseService.activeEncoding="SGR_PIXELS";break;case 25:this._coreService.isCursorHidden=!1;break;case 1048:this.saveCursor();break;case 1049:this.saveCursor();case 47:case 1047:this._bufferService.buffers.activateAltBuffer(this._eraseAttrData()),this._coreService.isCursorInitialized=!0,this._onRequestRefreshRows.fire(0,this._bufferService.rows-1),this._onRequestSyncScrollBar.fire();break;case 2004:this._coreService.decPrivateModes.bracketedPasteMode=!0}return!0}resetMode(C){for(let w=0;w<C.length;w++)switch(C.params[w]){case 4:this._coreService.modes.insertMode=!1;break;case 20:this._optionsService.options.convertEol=!1}return!0}resetModePrivate(C){for(let w=0;w<C.length;w++)switch(C.params[w]){case 1:this._coreService.decPrivateModes.applicationCursorKeys=!1;break;case 3:this._optionsService.rawOptions.windowOptions.setWinLines&&(this._bufferService.resize(80,this._bufferService.rows),this._onRequestReset.fire());break;case 6:this._coreService.decPrivateModes.origin=!1,this._setCursor(0,0);break;case 7:this._coreService.decPrivateModes.wraparound=!1;break;case 12:this._optionsService.options.cursorBlink=!1;break;case 45:this._coreService.decPrivateModes.reverseWraparound=!1;break;case 66:this._logService.debug("Switching back to normal keypad."),this._coreService.decPrivateModes.applicationKeypad=!1,this._onRequestSyncScrollBar.fire();break;case 9:case 1e3:case 1002:case 1003:this._coreMouseService.activeProtocol="NONE";break;case 1004:this._coreService.decPrivateModes.sendFocus=!1;break;case 1005:this._logService.debug("DECRST 1005 not supported (see #2507)");break;case 1006:case 1016:this._coreMouseService.activeEncoding="DEFAULT";break;case 1015:this._logService.debug("DECRST 1015 not supported (see #2507)");break;case 25:this._coreService.isCursorHidden=!0;break;case 1048:this.restoreCursor();break;case 1049:case 47:case 1047:this._bufferService.buffers.activateNormalBuffer(),C.params[w]===1049&&this.restoreCursor(),this._coreService.isCursorInitialized=!0,this._onRequestRefreshRows.fire(0,this._bufferService.rows-1),this._onRequestSyncScrollBar.fire();break;case 2004:this._coreService.decPrivateModes.bracketedPasteMode=!1}return!0}requestMode(C,w){let E=this._coreService.decPrivateModes,{activeProtocol:D,activeEncoding:I}=this._coreMouseService,H=this._coreService,{buffers:U,cols:W}=this._bufferService,{active:V,alt:S}=U,R=this._optionsService.rawOptions,B=K=>K?1:2,A=C.params[0];return N=A,F=w?A===2?4:A===4?B(H.modes.insertMode):A===12?3:A===20?B(R.convertEol):0:A===1?B(E.applicationCursorKeys):A===3?R.windowOptions.setWinLines?W===80?2:W===132?1:0:0:A===6?B(E.origin):A===7?B(E.wraparound):A===8?3:A===9?B(D==="X10"):A===12?B(R.cursorBlink):A===25?B(!H.isCursorHidden):A===45?B(E.reverseWraparound):A===66?B(E.applicationKeypad):A===67?4:A===1e3?B(D==="VT200"):A===1002?B(D==="DRAG"):A===1003?B(D==="ANY"):A===1004?B(E.sendFocus):A===1005?4:A===1006?B(I==="SGR"):A===1015?4:A===1016?B(I==="SGR_PIXELS"):A===1048?1:A===47||A===1047||A===1049?B(V===S):A===2004?B(E.bracketedPasteMode):0,H.triggerDataEvent(`${n.C0.ESC}[${w?"":"?"}${N};${F}$y`),!0;var N,F}_updateAttrColor(C,w,E,D,I){return w===2?(C|=50331648,C&=-16777216,C|=o.AttributeData.fromColorRGB([E,D,I])):w===5&&(C&=-50331904,C|=33554432|255&E),C}_extractColor(C,w,E){let D=[0,0,-1,0,0,0],I=0,H=0;do{if(D[H+I]=C.params[w+H],C.hasSubParams(w+H)){let U=C.getSubParams(w+H),W=0;do D[1]===5&&(I=1),D[H+W+1+I]=U[W];while(++W<U.length&&W+H+1+I<D.length);break}if(D[1]===5&&H+I>=2||D[1]===2&&H+I>=5)break;D[1]&&(I=1)}while(++H+w<C.length&&H+I<D.length);for(let U=2;U<D.length;++U)D[U]===-1&&(D[U]=0);switch(D[0]){case 38:E.fg=this._updateAttrColor(E.fg,D[1],D[3],D[4],D[5]);break;case 48:E.bg=this._updateAttrColor(E.bg,D[1],D[3],D[4],D[5]);break;case 58:E.extended=E.extended.clone(),E.extended.underlineColor=this._updateAttrColor(E.extended.underlineColor,D[1],D[3],D[4],D[5])}return H}_processUnderline(C,w){w.extended=w.extended.clone(),(!~C||C>5)&&(C=1),w.extended.underlineStyle=C,w.fg|=268435456,C===0&&(w.fg&=-268435457),w.updateExtended()}_processSGR0(C){C.fg=e.DEFAULT_ATTR_DATA.fg,C.bg=e.DEFAULT_ATTR_DATA.bg,C.extended=C.extended.clone(),C.extended.underlineStyle=0,C.extended.underlineColor&=-67108864,C.updateExtended()}charAttributes(C){if(C.length===1&&C.params[0]===0)return this._processSGR0(this._curAttrData),!0;let w=C.length,E,D=this._curAttrData;for(let I=0;I<w;I++)E=C.params[I],E>=30&&E<=37?(D.fg&=-50331904,D.fg|=16777216|E-30):E>=40&&E<=47?(D.bg&=-50331904,D.bg|=16777216|E-40):E>=90&&E<=97?(D.fg&=-50331904,D.fg|=16777224|E-90):E>=100&&E<=107?(D.bg&=-50331904,D.bg|=16777224|E-100):E===0?this._processSGR0(D):E===1?D.fg|=134217728:E===3?D.bg|=67108864:E===4?(D.fg|=268435456,this._processUnderline(C.hasSubParams(I)?C.getSubParams(I)[0]:1,D)):E===5?D.fg|=536870912:E===7?D.fg|=67108864:E===8?D.fg|=1073741824:E===9?D.fg|=2147483648:E===2?D.bg|=134217728:E===21?this._processUnderline(2,D):E===22?(D.fg&=-134217729,D.bg&=-134217729):E===23?D.bg&=-67108865:E===24?(D.fg&=-268435457,this._processUnderline(0,D)):E===25?D.fg&=-536870913:E===27?D.fg&=-67108865:E===28?D.fg&=-1073741825:E===29?D.fg&=2147483647:E===39?(D.fg&=-67108864,D.fg|=16777215&e.DEFAULT_ATTR_DATA.fg):E===49?(D.bg&=-67108864,D.bg|=16777215&e.DEFAULT_ATTR_DATA.bg):E===38||E===48||E===58?I+=this._extractColor(C,I,D):E===53?D.bg|=1073741824:E===55?D.bg&=-1073741825:E===59?(D.extended=D.extended.clone(),D.extended.underlineColor=-1,D.updateExtended()):E===100?(D.fg&=-67108864,D.fg|=16777215&e.DEFAULT_ATTR_DATA.fg,D.bg&=-67108864,D.bg|=16777215&e.DEFAULT_ATTR_DATA.bg):this._logService.debug("Unknown SGR attribute: %d.",E);return!0}deviceStatus(C){switch(C.params[0]){case 5:this._coreService.triggerDataEvent(`${n.C0.ESC}[0n`);break;case 6:let w=this._activeBuffer.y+1,E=this._activeBuffer.x+1;this._coreService.triggerDataEvent(`${n.C0.ESC}[${w};${E}R`)}return!0}deviceStatusPrivate(C){if(C.params[0]===6){let w=this._activeBuffer.y+1,E=this._activeBuffer.x+1;this._coreService.triggerDataEvent(`${n.C0.ESC}[?${w};${E}R`)}return!0}softReset(C){return this._coreService.isCursorHidden=!1,this._onRequestSyncScrollBar.fire(),this._activeBuffer.scrollTop=0,this._activeBuffer.scrollBottom=this._bufferService.rows-1,this._curAttrData=e.DEFAULT_ATTR_DATA.clone(),this._coreService.reset(),this._charsetService.reset(),this._activeBuffer.savedX=0,this._activeBuffer.savedY=this._activeBuffer.ybase,this._activeBuffer.savedCurAttrData.fg=this._curAttrData.fg,this._activeBuffer.savedCurAttrData.bg=this._curAttrData.bg,this._activeBuffer.savedCharset=this._charsetService.charset,this._coreService.decPrivateModes.origin=!1,!0}setCursorStyle(C){let w=C.params[0]||1;switch(w){case 1:case 2:this._optionsService.options.cursorStyle="block";break;case 3:case 4:this._optionsService.options.cursorStyle="underline";break;case 5:case 6:this._optionsService.options.cursorStyle="bar"}let E=w%2==1;return this._optionsService.options.cursorBlink=E,!0}setScrollRegion(C){let w=C.params[0]||1,E;return(C.length<2||(E=C.params[1])>this._bufferService.rows||E===0)&&(E=this._bufferService.rows),E>w&&(this._activeBuffer.scrollTop=w-1,this._activeBuffer.scrollBottom=E-1,this._setCursor(0,0)),!0}windowOptions(C){if(!L(C.params[0],this._optionsService.rawOptions.windowOptions))return!0;let w=C.length>1?C.params[1]:0;switch(C.params[0]){case 14:w!==2&&this._onRequestWindowsOptionsReport.fire(y.GET_WIN_SIZE_PIXELS);break;case 16:this._onRequestWindowsOptionsReport.fire(y.GET_CELL_SIZE_PIXELS);break;case 18:this._bufferService&&this._coreService.triggerDataEvent(`${n.C0.ESC}[8;${this._bufferService.rows};${this._bufferService.cols}t`);break;case 22:w!==0&&w!==2||(this._windowTitleStack.push(this._windowTitle),this._windowTitleStack.length>10&&this._windowTitleStack.shift()),w!==0&&w!==1||(this._iconNameStack.push(this._iconName),this._iconNameStack.length>10&&this._iconNameStack.shift());break;case 23:w!==0&&w!==2||this._windowTitleStack.length&&this.setTitle(this._windowTitleStack.pop()),w!==0&&w!==1||this._iconNameStack.length&&this.setIconName(this._iconNameStack.pop())}return!0}saveCursor(C){return this._activeBuffer.savedX=this._activeBuffer.x,this._activeBuffer.savedY=this._activeBuffer.ybase+this._activeBuffer.y,this._activeBuffer.savedCurAttrData.fg=this._curAttrData.fg,this._activeBuffer.savedCurAttrData.bg=this._curAttrData.bg,this._activeBuffer.savedCharset=this._charsetService.charset,!0}restoreCursor(C){return this._activeBuffer.x=this._activeBuffer.savedX||0,this._activeBuffer.y=Math.max(this._activeBuffer.savedY-this._activeBuffer.ybase,0),this._curAttrData.fg=this._activeBuffer.savedCurAttrData.fg,this._curAttrData.bg=this._activeBuffer.savedCurAttrData.bg,this._charsetService.charset=this._savedCharset,this._activeBuffer.savedCharset&&(this._charsetService.charset=this._activeBuffer.savedCharset),this._restrictCursor(),!0}setTitle(C){return this._windowTitle=C,this._onTitleChange.fire(C),!0}setIconName(C){return this._iconName=C,!0}setOrReportIndexedColor(C){let w=[],E=C.split(";");for(;E.length>1;){let D=E.shift(),I=E.shift();if(/^\d+$/.exec(D)){let H=parseInt(D);if(P(H))if(I==="?")w.push({type:0,index:H});else{let U=(0,h.parseColor)(I);U&&w.push({type:1,index:H,color:U})}}}return w.length&&this._onColor.fire(w),!0}setHyperlink(C){let w=C.split(";");return!(w.length<2)&&(w[1]?this._createHyperlink(w[0],w[1]):!w[0]&&this._finishHyperlink())}_createHyperlink(C,w){this._getCurrentLinkId()&&this._finishHyperlink();let E=C.split(":"),D,I=E.findIndex((H=>H.startsWith("id=")));return I!==-1&&(D=E[I].slice(3)||void 0),this._curAttrData.extended=this._curAttrData.extended.clone(),this._curAttrData.extended.urlId=this._oscLinkService.registerLink({id:D,uri:w}),this._curAttrData.updateExtended(),!0}_finishHyperlink(){return this._curAttrData.extended=this._curAttrData.extended.clone(),this._curAttrData.extended.urlId=0,this._curAttrData.updateExtended(),!0}_setOrReportSpecialColor(C,w){let E=C.split(";");for(let D=0;D<E.length&&!(w>=this._specialColors.length);++D,++w)if(E[D]==="?")this._onColor.fire([{type:0,index:this._specialColors[w]}]);else{let I=(0,h.parseColor)(E[D]);I&&this._onColor.fire([{type:1,index:this._specialColors[w],color:I}])}return!0}setOrReportFgColor(C){return this._setOrReportSpecialColor(C,0)}setOrReportBgColor(C){return this._setOrReportSpecialColor(C,1)}setOrReportCursorColor(C){return this._setOrReportSpecialColor(C,2)}restoreIndexedColor(C){if(!C)return this._onColor.fire([{type:2}]),!0;let w=[],E=C.split(";");for(let D=0;D<E.length;++D)if(/^\d+$/.exec(E[D])){let I=parseInt(E[D]);P(I)&&w.push({type:2,index:I})}return w.length&&this._onColor.fire(w),!0}restoreFgColor(C){return this._onColor.fire([{type:2,index:256}]),!0}restoreBgColor(C){return this._onColor.fire([{type:2,index:257}]),!0}restoreCursorColor(C){return this._onColor.fire([{type:2,index:258}]),!0}nextLine(){return this._activeBuffer.x=0,this.index(),!0}keypadApplicationMode(){return this._logService.debug("Serial port requested application keypad."),this._coreService.decPrivateModes.applicationKeypad=!0,this._onRequestSyncScrollBar.fire(),!0}keypadNumericMode(){return this._logService.debug("Switching back to normal keypad."),this._coreService.decPrivateModes.applicationKeypad=!1,this._onRequestSyncScrollBar.fire(),!0}selectDefaultCharset(){return this._charsetService.setgLevel(0),this._charsetService.setgCharset(0,d.DEFAULT_CHARSET),!0}selectCharset(C){return C.length!==2?(this.selectDefaultCharset(),!0):(C[0]==="/"||this._charsetService.setgCharset(g[C[0]],d.CHARSETS[C[1]]||d.DEFAULT_CHARSET),!0)}index(){return this._restrictCursor(),this._activeBuffer.y++,this._activeBuffer.y===this._activeBuffer.scrollBottom+1?(this._activeBuffer.y--,this._bufferService.scroll(this._eraseAttrData())):this._activeBuffer.y>=this._bufferService.rows&&(this._activeBuffer.y=this._bufferService.rows-1),this._restrictCursor(),!0}tabSet(){return this._activeBuffer.tabs[this._activeBuffer.x]=!0,!0}reverseIndex(){if(this._restrictCursor(),this._activeBuffer.y===this._activeBuffer.scrollTop){let C=this._activeBuffer.scrollBottom-this._activeBuffer.scrollTop;this._activeBuffer.lines.shiftElements(this._activeBuffer.ybase+this._activeBuffer.y,C,1),this._activeBuffer.lines.set(this._activeBuffer.ybase+this._activeBuffer.y,this._activeBuffer.getBlankLine(this._eraseAttrData())),this._dirtyRowTracker.markRangeDirty(this._activeBuffer.scrollTop,this._activeBuffer.scrollBottom)}else this._activeBuffer.y--,this._restrictCursor();return!0}fullReset(){return this._parser.reset(),this._onRequestReset.fire(),!0}reset(){this._curAttrData=e.DEFAULT_ATTR_DATA.clone(),this._eraseAttrDataInternal=e.DEFAULT_ATTR_DATA.clone()}_eraseAttrData(){return this._eraseAttrDataInternal.bg&=-67108864,this._eraseAttrDataInternal.bg|=67108863&this._curAttrData.bg,this._eraseAttrDataInternal}setgLevel(C){return this._charsetService.setgLevel(C),!0}screenAlignmentPattern(){let C=new i.CellData;C.content=4194373,C.fg=this._curAttrData.fg,C.bg=this._curAttrData.bg,this._setCursor(0,0);for(let w=0;w<this._bufferService.rows;++w){let E=this._activeBuffer.ybase+this._activeBuffer.y+w,D=this._activeBuffer.lines.get(E);D&&(D.fill(C),D.isWrapped=!1)}return this._dirtyRowTracker.markAllDirty(),this._setCursor(0,0),!0}requestStatusString(C,w){let E=this._bufferService.buffer,D=this._optionsService.rawOptions;return(I=>(this._coreService.triggerDataEvent(`${n.C0.ESC}${I}${n.C0.ESC}\\`),!0))(C==='"q'?`P1$r${this._curAttrData.isProtected()?1:0}"q`:C==='"p'?'P1$r61;1"p':C==="r"?`P1$r${E.scrollTop+1};${E.scrollBottom+1}r`:C==="m"?"P1$r0m":C===" q"?`P1$r${{block:2,underline:4,bar:6}[D.cursorStyle]-(D.cursorBlink?1:0)} q`:"P0$r")}markRangeDirty(C,w){this._dirtyRowTracker.markRangeDirty(C,w)}}r.InputHandler=x;let T=class{constructor(M){this._bufferService=M,this.clearRange()}clearRange(){this.start=this._bufferService.buffer.y,this.end=this._bufferService.buffer.y}markDirty(M){M<this.start?this.start=M:M>this.end&&(this.end=M)}markRangeDirty(M,C){M>C&&(k=M,M=C,C=k),M<this.start&&(this.start=M),C>this.end&&(this.end=C)}markAllDirty(){this.markRangeDirty(0,this._bufferService.rows-1)}};function P(M){return 0<=M&&M<256}T=l([u(0,c.IBufferService)],T)},844:(O,r)=>{function a(l){for(let u of l)u.dispose();l.length=0}Object.defineProperty(r,"__esModule",{value:!0}),r.getDisposeArrayDisposable=r.disposeArray=r.toDisposable=r.MutableDisposable=r.Disposable=void 0,r.Disposable=class{constructor(){this._disposables=[],this._isDisposed=!1}dispose(){this._isDisposed=!0;for(let l of this._disposables)l.dispose();this._disposables.length=0}register(l){return this._disposables.push(l),l}unregister(l){let u=this._disposables.indexOf(l);u!==-1&&this._disposables.splice(u,1)}},r.MutableDisposable=class{constructor(){this._isDisposed=!1}get value(){return this._isDisposed?void 0:this._value}set value(l){var u;this._isDisposed||l===this._value||((u=this._value)===null||u===void 0||u.dispose(),this._value=l)}clear(){this.value=void 0}dispose(){var l;this._isDisposed=!0,(l=this._value)===null||l===void 0||l.dispose(),this._value=void 0}},r.toDisposable=function(l){return{dispose:l}},r.disposeArray=a,r.getDisposeArrayDisposable=function(l){return{dispose:()=>a(l)}}},1505:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.FourKeyMap=r.TwoKeyMap=void 0;class a{constructor(){this._data={}}set(u,n,d){this._data[u]||(this._data[u]={}),this._data[u][n]=d}get(u,n){return this._data[u]?this._data[u][n]:void 0}clear(){this._data={}}}r.TwoKeyMap=a,r.FourKeyMap=class{constructor(){this._data=new a}set(l,u,n,d,f){this._data.get(l,u)||this._data.set(l,u,new a),this._data.get(l,u).set(n,d,f)}get(l,u,n,d){var f;return(f=this._data.get(l,u))===null||f===void 0?void 0:f.get(n,d)}clear(){this._data.clear()}}},6114:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.isChromeOS=r.isLinux=r.isWindows=r.isIphone=r.isIpad=r.isMac=r.getSafariVersion=r.isSafari=r.isLegacyEdge=r.isFirefox=r.isNode=void 0,r.isNode=typeof navigator>"u";let a=r.isNode?"node":navigator.userAgent,l=r.isNode?"node":navigator.platform;r.isFirefox=a.includes("Firefox"),r.isLegacyEdge=a.includes("Edge"),r.isSafari=/^((?!chrome|android).)*safari/i.test(a),r.getSafariVersion=function(){if(!r.isSafari)return 0;let u=a.match(/Version\/(\d+)/);return u===null||u.length<2?0:parseInt(u[1])},r.isMac=["Macintosh","MacIntel","MacPPC","Mac68K"].includes(l),r.isIpad=l==="iPad",r.isIphone=l==="iPhone",r.isWindows=["Windows","Win16","Win32","WinCE"].includes(l),r.isLinux=l.indexOf("Linux")>=0,r.isChromeOS=/\bCrOS\b/.test(a)},6106:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.SortedList=void 0;let a=0;r.SortedList=class{constructor(l){this._getKey=l,this._array=[]}clear(){this._array.length=0}insert(l){this._array.length!==0?(a=this._search(this._getKey(l)),this._array.splice(a,0,l)):this._array.push(l)}delete(l){if(this._array.length===0)return!1;let u=this._getKey(l);if(u===void 0||(a=this._search(u),a===-1)||this._getKey(this._array[a])!==u)return!1;do if(this._array[a]===l)return this._array.splice(a,1),!0;while(++a<this._array.length&&this._getKey(this._array[a])===u);return!1}*getKeyIterator(l){if(this._array.length!==0&&(a=this._search(l),!(a<0||a>=this._array.length)&&this._getKey(this._array[a])===l))do yield this._array[a];while(++a<this._array.length&&this._getKey(this._array[a])===l)}forEachByKey(l,u){if(this._array.length!==0&&(a=this._search(l),!(a<0||a>=this._array.length)&&this._getKey(this._array[a])===l))do u(this._array[a]);while(++a<this._array.length&&this._getKey(this._array[a])===l)}values(){return[...this._array].values()}_search(l){let u=0,n=this._array.length-1;for(;n>=u;){let d=u+n>>1,f=this._getKey(this._array[d]);if(f>l)n=d-1;else{if(!(f<l)){for(;d>0&&this._getKey(this._array[d-1])===l;)d--;return d}u=d+1}}return u}}},7226:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.DebouncedIdleTask=r.IdleTaskQueue=r.PriorityTaskQueue=void 0;let l=a(6114);class u{constructor(){this._tasks=[],this._i=0}enqueue(f){this._tasks.push(f),this._start()}flush(){for(;this._i<this._tasks.length;)this._tasks[this._i]()||this._i++;this.clear()}clear(){this._idleCallback&&(this._cancelCallback(this._idleCallback),this._idleCallback=void 0),this._i=0,this._tasks.length=0}_start(){this._idleCallback||(this._idleCallback=this._requestCallback(this._process.bind(this)))}_process(f){this._idleCallback=void 0;let p=0,_=0,e=f.timeRemaining(),s=0;for(;this._i<this._tasks.length;){if(p=Date.now(),this._tasks[this._i]()||this._i++,p=Math.max(1,Date.now()-p),_=Math.max(p,_),s=f.timeRemaining(),1.5*_>s)return e-p<-20&&console.warn(`task queue exceeded allotted deadline by ${Math.abs(Math.round(e-p))}ms`),void this._start();e=s}this.clear()}}class n extends u{_requestCallback(f){return setTimeout((()=>f(this._createDeadline(16))))}_cancelCallback(f){clearTimeout(f)}_createDeadline(f){let p=Date.now()+f;return{timeRemaining:()=>Math.max(0,p-Date.now())}}}r.PriorityTaskQueue=n,r.IdleTaskQueue=!l.isNode&&"requestIdleCallback"in window?class extends u{_requestCallback(d){return requestIdleCallback(d)}_cancelCallback(d){cancelIdleCallback(d)}}:n,r.DebouncedIdleTask=class{constructor(){this._queue=new r.IdleTaskQueue}set(d){this._queue.clear(),this._queue.enqueue(d)}flush(){this._queue.flush()}}},9282:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.updateWindowsModeWrappedState=void 0;let l=a(643);r.updateWindowsModeWrappedState=function(u){let n=u.buffer.lines.get(u.buffer.ybase+u.buffer.y-1),d=n?.get(u.cols-1),f=u.buffer.lines.get(u.buffer.ybase+u.buffer.y);f&&d&&(f.isWrapped=d[l.CHAR_DATA_CODE_INDEX]!==l.NULL_CELL_CODE&&d[l.CHAR_DATA_CODE_INDEX]!==l.WHITESPACE_CELL_CODE)}},3734:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.ExtendedAttrs=r.AttributeData=void 0;class a{constructor(){this.fg=0,this.bg=0,this.extended=new l}static toColorRGB(n){return[n>>>16&255,n>>>8&255,255&n]}static fromColorRGB(n){return(255&n[0])<<16|(255&n[1])<<8|255&n[2]}clone(){let n=new a;return n.fg=this.fg,n.bg=this.bg,n.extended=this.extended.clone(),n}isInverse(){return 67108864&this.fg}isBold(){return 134217728&this.fg}isUnderline(){return this.hasExtendedAttrs()&&this.extended.underlineStyle!==0?1:268435456&this.fg}isBlink(){return 536870912&this.fg}isInvisible(){return 1073741824&this.fg}isItalic(){return 67108864&this.bg}isDim(){return 134217728&this.bg}isStrikethrough(){return 2147483648&this.fg}isProtected(){return 536870912&this.bg}isOverline(){return 1073741824&this.bg}getFgColorMode(){return 50331648&this.fg}getBgColorMode(){return 50331648&this.bg}isFgRGB(){return(50331648&this.fg)==50331648}isBgRGB(){return(50331648&this.bg)==50331648}isFgPalette(){return(50331648&this.fg)==16777216||(50331648&this.fg)==33554432}isBgPalette(){return(50331648&this.bg)==16777216||(50331648&this.bg)==33554432}isFgDefault(){return(50331648&this.fg)==0}isBgDefault(){return(50331648&this.bg)==0}isAttributeDefault(){return this.fg===0&&this.bg===0}getFgColor(){switch(50331648&this.fg){case 16777216:case 33554432:return 255&this.fg;case 50331648:return 16777215&this.fg;default:return-1}}getBgColor(){switch(50331648&this.bg){case 16777216:case 33554432:return 255&this.bg;case 50331648:return 16777215&this.bg;default:return-1}}hasExtendedAttrs(){return 268435456&this.bg}updateExtended(){this.extended.isEmpty()?this.bg&=-268435457:this.bg|=268435456}getUnderlineColor(){if(268435456&this.bg&&~this.extended.underlineColor)switch(50331648&this.extended.underlineColor){case 16777216:case 33554432:return 255&this.extended.underlineColor;case 50331648:return 16777215&this.extended.underlineColor;default:return this.getFgColor()}return this.getFgColor()}getUnderlineColorMode(){return 268435456&this.bg&&~this.extended.underlineColor?50331648&this.extended.underlineColor:this.getFgColorMode()}isUnderlineColorRGB(){return 268435456&this.bg&&~this.extended.underlineColor?(50331648&this.extended.underlineColor)==50331648:this.isFgRGB()}isUnderlineColorPalette(){return 268435456&this.bg&&~this.extended.underlineColor?(50331648&this.extended.underlineColor)==16777216||(50331648&this.extended.underlineColor)==33554432:this.isFgPalette()}isUnderlineColorDefault(){return 268435456&this.bg&&~this.extended.underlineColor?(50331648&this.extended.underlineColor)==0:this.isFgDefault()}getUnderlineStyle(){return 268435456&this.fg?268435456&this.bg?this.extended.underlineStyle:1:0}}r.AttributeData=a;class l{get ext(){return this._urlId?-469762049&this._ext|this.underlineStyle<<26:this._ext}set ext(n){this._ext=n}get underlineStyle(){return this._urlId?5:(469762048&this._ext)>>26}set underlineStyle(n){this._ext&=-469762049,this._ext|=n<<26&469762048}get underlineColor(){return 67108863&this._ext}set underlineColor(n){this._ext&=-67108864,this._ext|=67108863&n}get urlId(){return this._urlId}set urlId(n){this._urlId=n}constructor(n=0,d=0){this._ext=0,this._urlId=0,this._ext=n,this._urlId=d}clone(){return new l(this._ext,this._urlId)}isEmpty(){return this.underlineStyle===0&&this._urlId===0}}r.ExtendedAttrs=l},9092:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.Buffer=r.MAX_BUFFER_SIZE=void 0;let l=a(6349),u=a(7226),n=a(3734),d=a(8437),f=a(4634),p=a(511),_=a(643),e=a(4863),s=a(7116);r.MAX_BUFFER_SIZE=4294967295,r.Buffer=class{constructor(t,i,o){this._hasScrollback=t,this._optionsService=i,this._bufferService=o,this.ydisp=0,this.ybase=0,this.y=0,this.x=0,this.tabs={},this.savedY=0,this.savedX=0,this.savedCurAttrData=d.DEFAULT_ATTR_DATA.clone(),this.savedCharset=s.DEFAULT_CHARSET,this.markers=[],this._nullCell=p.CellData.fromCharData([0,_.NULL_CELL_CHAR,_.NULL_CELL_WIDTH,_.NULL_CELL_CODE]),this._whitespaceCell=p.CellData.fromCharData([0,_.WHITESPACE_CELL_CHAR,_.WHITESPACE_CELL_WIDTH,_.WHITESPACE_CELL_CODE]),this._isClearing=!1,this._memoryCleanupQueue=new u.IdleTaskQueue,this._memoryCleanupPosition=0,this._cols=this._bufferService.cols,this._rows=this._bufferService.rows,this.lines=new l.CircularList(this._getCorrectBufferLength(this._rows)),this.scrollTop=0,this.scrollBottom=this._rows-1,this.setupTabStops()}getNullCell(t){return t?(this._nullCell.fg=t.fg,this._nullCell.bg=t.bg,this._nullCell.extended=t.extended):(this._nullCell.fg=0,this._nullCell.bg=0,this._nullCell.extended=new n.ExtendedAttrs),this._nullCell}getWhitespaceCell(t){return t?(this._whitespaceCell.fg=t.fg,this._whitespaceCell.bg=t.bg,this._whitespaceCell.extended=t.extended):(this._whitespaceCell.fg=0,this._whitespaceCell.bg=0,this._whitespaceCell.extended=new n.ExtendedAttrs),this._whitespaceCell}getBlankLine(t,i){return new d.BufferLine(this._bufferService.cols,this.getNullCell(t),i)}get hasScrollback(){return this._hasScrollback&&this.lines.maxLength>this._rows}get isCursorInViewport(){let t=this.ybase+this.y-this.ydisp;return t>=0&&t<this._rows}_getCorrectBufferLength(t){if(!this._hasScrollback)return t;let i=t+this._optionsService.rawOptions.scrollback;return i>r.MAX_BUFFER_SIZE?r.MAX_BUFFER_SIZE:i}fillViewportRows(t){if(this.lines.length===0){t===void 0&&(t=d.DEFAULT_ATTR_DATA);let i=this._rows;for(;i--;)this.lines.push(this.getBlankLine(t))}}clear(){this.ydisp=0,this.ybase=0,this.y=0,this.x=0,this.lines=new l.CircularList(this._getCorrectBufferLength(this._rows)),this.scrollTop=0,this.scrollBottom=this._rows-1,this.setupTabStops()}resize(t,i){let o=this.getNullCell(d.DEFAULT_ATTR_DATA),c=0,v=this._getCorrectBufferLength(i);if(v>this.lines.maxLength&&(this.lines.maxLength=v),this.lines.length>0){if(this._cols<t)for(let h=0;h<this.lines.length;h++)c+=+this.lines.get(h).resize(t,o);let m=0;if(this._rows<i)for(let h=this._rows;h<i;h++)this.lines.length<i+this.ybase&&(this._optionsService.rawOptions.windowsMode||this._optionsService.rawOptions.windowsPty.backend!==void 0||this._optionsService.rawOptions.windowsPty.buildNumber!==void 0?this.lines.push(new d.BufferLine(t,o)):this.ybase>0&&this.lines.length<=this.ybase+this.y+m+1?(this.ybase--,m++,this.ydisp>0&&this.ydisp--):this.lines.push(new d.BufferLine(t,o)));else for(let h=this._rows;h>i;h--)this.lines.length>i+this.ybase&&(this.lines.length>this.ybase+this.y+1?this.lines.pop():(this.ybase++,this.ydisp++));if(v<this.lines.maxLength){let h=this.lines.length-v;h>0&&(this.lines.trimStart(h),this.ybase=Math.max(this.ybase-h,0),this.ydisp=Math.max(this.ydisp-h,0),this.savedY=Math.max(this.savedY-h,0)),this.lines.maxLength=v}this.x=Math.min(this.x,t-1),this.y=Math.min(this.y,i-1),m&&(this.y+=m),this.savedX=Math.min(this.savedX,t-1),this.scrollTop=0}if(this.scrollBottom=i-1,this._isReflowEnabled&&(this._reflow(t,i),this._cols>t))for(let m=0;m<this.lines.length;m++)c+=+this.lines.get(m).resize(t,o);this._cols=t,this._rows=i,this._memoryCleanupQueue.clear(),c>.1*this.lines.length&&(this._memoryCleanupPosition=0,this._memoryCleanupQueue.enqueue((()=>this._batchedMemoryCleanup())))}_batchedMemoryCleanup(){let t=!0;this._memoryCleanupPosition>=this.lines.length&&(this._memoryCleanupPosition=0,t=!1);let i=0;for(;this._memoryCleanupPosition<this.lines.length;)if(i+=this.lines.get(this._memoryCleanupPosition++).cleanupMemory(),i>100)return!0;return t}get _isReflowEnabled(){let t=this._optionsService.rawOptions.windowsPty;return t&&t.buildNumber?this._hasScrollback&&t.backend==="conpty"&&t.buildNumber>=21376:this._hasScrollback&&!this._optionsService.rawOptions.windowsMode}_reflow(t,i){this._cols!==t&&(t>this._cols?this._reflowLarger(t,i):this._reflowSmaller(t,i))}_reflowLarger(t,i){let o=(0,f.reflowLargerGetLinesToRemove)(this.lines,this._cols,t,this.ybase+this.y,this.getNullCell(d.DEFAULT_ATTR_DATA));if(o.length>0){let c=(0,f.reflowLargerCreateNewLayout)(this.lines,o);(0,f.reflowLargerApplyNewLayout)(this.lines,c.layout),this._reflowLargerAdjustViewport(t,i,c.countRemoved)}}_reflowLargerAdjustViewport(t,i,o){let c=this.getNullCell(d.DEFAULT_ATTR_DATA),v=o;for(;v-- >0;)this.ybase===0?(this.y>0&&this.y--,this.lines.length<i&&this.lines.push(new d.BufferLine(t,c))):(this.ydisp===this.ybase&&this.ydisp--,this.ybase--);this.savedY=Math.max(this.savedY-o,0)}_reflowSmaller(t,i){let o=this.getNullCell(d.DEFAULT_ATTR_DATA),c=[],v=0;for(let m=this.lines.length-1;m>=0;m--){let h=this.lines.get(m);if(!h||!h.isWrapped&&h.getTrimmedLength()<=t)continue;let g=[h];for(;h.isWrapped&&m>0;)h=this.lines.get(--m),g.unshift(h);let b=this.ybase+this.y;if(b>=m&&b<m+g.length)continue;let L=g[g.length-1].getTrimmedLength(),y=(0,f.reflowSmallerGetNewLineLengths)(g,this._cols,t),k=y.length-g.length,x;x=this.ybase===0&&this.y!==this.lines.length-1?Math.max(0,this.y-this.lines.maxLength+k):Math.max(0,this.lines.length-this.lines.maxLength+k);let T=[];for(let D=0;D<k;D++){let I=this.getBlankLine(d.DEFAULT_ATTR_DATA,!0);T.push(I)}T.length>0&&(c.push({start:m+g.length+v,newLines:T}),v+=T.length),g.push(...T);let P=y.length-1,M=y[P];M===0&&(P--,M=y[P]);let C=g.length-k-1,w=L;for(;C>=0;){let D=Math.min(w,M);if(g[P]===void 0)break;if(g[P].copyCellsFrom(g[C],w-D,M-D,D,!0),M-=D,M===0&&(P--,M=y[P]),w-=D,w===0){C--;let I=Math.max(C,0);w=(0,f.getWrappedLineTrimmedLength)(g,I,this._cols)}}for(let D=0;D<g.length;D++)y[D]<t&&g[D].setCell(y[D],o);let E=k-x;for(;E-- >0;)this.ybase===0?this.y<i-1?(this.y++,this.lines.pop()):(this.ybase++,this.ydisp++):this.ybase<Math.min(this.lines.maxLength,this.lines.length+v)-i&&(this.ybase===this.ydisp&&this.ydisp++,this.ybase++);this.savedY=Math.min(this.savedY+k,this.ybase+i-1)}if(c.length>0){let m=[],h=[];for(let P=0;P<this.lines.length;P++)h.push(this.lines.get(P));let g=this.lines.length,b=g-1,L=0,y=c[L];this.lines.length=Math.min(this.lines.maxLength,this.lines.length+v);let k=0;for(let P=Math.min(this.lines.maxLength-1,g+v-1);P>=0;P--)if(y&&y.start>b+k){for(let M=y.newLines.length-1;M>=0;M--)this.lines.set(P--,y.newLines[M]);P++,m.push({index:b+1,amount:y.newLines.length}),k+=y.newLines.length,y=c[++L]}else this.lines.set(P,h[b--]);let x=0;for(let P=m.length-1;P>=0;P--)m[P].index+=x,this.lines.onInsertEmitter.fire(m[P]),x+=m[P].amount;let T=Math.max(0,g+v-this.lines.maxLength);T>0&&this.lines.onTrimEmitter.fire(T)}}translateBufferLineToString(t,i,o=0,c){let v=this.lines.get(t);return v?v.translateToString(i,o,c):""}getWrappedRangeForLine(t){let i=t,o=t;for(;i>0&&this.lines.get(i).isWrapped;)i--;for(;o+1<this.lines.length&&this.lines.get(o+1).isWrapped;)o++;return{first:i,last:o}}setupTabStops(t){for(t!=null?this.tabs[t]||(t=this.prevStop(t)):(this.tabs={},t=0);t<this._cols;t+=this._optionsService.rawOptions.tabStopWidth)this.tabs[t]=!0}prevStop(t){for(t==null&&(t=this.x);!this.tabs[--t]&&t>0;);return t>=this._cols?this._cols-1:t<0?0:t}nextStop(t){for(t==null&&(t=this.x);!this.tabs[++t]&&t<this._cols;);return t>=this._cols?this._cols-1:t<0?0:t}clearMarkers(t){this._isClearing=!0;for(let i=0;i<this.markers.length;i++)this.markers[i].line===t&&(this.markers[i].dispose(),this.markers.splice(i--,1));this._isClearing=!1}clearAllMarkers(){this._isClearing=!0;for(let t=0;t<this.markers.length;t++)this.markers[t].dispose(),this.markers.splice(t--,1);this._isClearing=!1}addMarker(t){let i=new e.Marker(t);return this.markers.push(i),i.register(this.lines.onTrim((o=>{i.line-=o,i.line<0&&i.dispose()}))),i.register(this.lines.onInsert((o=>{i.line>=o.index&&(i.line+=o.amount)}))),i.register(this.lines.onDelete((o=>{i.line>=o.index&&i.line<o.index+o.amount&&i.dispose(),i.line>o.index&&(i.line-=o.amount)}))),i.register(i.onDispose((()=>this._removeMarker(i)))),i}_removeMarker(t){this._isClearing||this.markers.splice(this.markers.indexOf(t),1)}}},8437:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.BufferLine=r.DEFAULT_ATTR_DATA=void 0;let l=a(3734),u=a(511),n=a(643),d=a(482);r.DEFAULT_ATTR_DATA=Object.freeze(new l.AttributeData);let f=0;class p{constructor(e,s,t=!1){this.isWrapped=t,this._combined={},this._extendedAttrs={},this._data=new Uint32Array(3*e);let i=s||u.CellData.fromCharData([0,n.NULL_CELL_CHAR,n.NULL_CELL_WIDTH,n.NULL_CELL_CODE]);for(let o=0;o<e;++o)this.setCell(o,i);this.length=e}get(e){let s=this._data[3*e+0],t=2097151&s;return[this._data[3*e+1],2097152&s?this._combined[e]:t?(0,d.stringFromCodePoint)(t):"",s>>22,2097152&s?this._combined[e].charCodeAt(this._combined[e].length-1):t]}set(e,s){this._data[3*e+1]=s[n.CHAR_DATA_ATTR_INDEX],s[n.CHAR_DATA_CHAR_INDEX].length>1?(this._combined[e]=s[1],this._data[3*e+0]=2097152|e|s[n.CHAR_DATA_WIDTH_INDEX]<<22):this._data[3*e+0]=s[n.CHAR_DATA_CHAR_INDEX].charCodeAt(0)|s[n.CHAR_DATA_WIDTH_INDEX]<<22}getWidth(e){return this._data[3*e+0]>>22}hasWidth(e){return 12582912&this._data[3*e+0]}getFg(e){return this._data[3*e+1]}getBg(e){return this._data[3*e+2]}hasContent(e){return 4194303&this._data[3*e+0]}getCodePoint(e){let s=this._data[3*e+0];return 2097152&s?this._combined[e].charCodeAt(this._combined[e].length-1):2097151&s}isCombined(e){return 2097152&this._data[3*e+0]}getString(e){let s=this._data[3*e+0];return 2097152&s?this._combined[e]:2097151&s?(0,d.stringFromCodePoint)(2097151&s):""}isProtected(e){return 536870912&this._data[3*e+2]}loadCell(e,s){return f=3*e,s.content=this._data[f+0],s.fg=this._data[f+1],s.bg=this._data[f+2],2097152&s.content&&(s.combinedData=this._combined[e]),268435456&s.bg&&(s.extended=this._extendedAttrs[e]),s}setCell(e,s){2097152&s.content&&(this._combined[e]=s.combinedData),268435456&s.bg&&(this._extendedAttrs[e]=s.extended),this._data[3*e+0]=s.content,this._data[3*e+1]=s.fg,this._data[3*e+2]=s.bg}setCellFromCodePoint(e,s,t,i,o,c){268435456&o&&(this._extendedAttrs[e]=c),this._data[3*e+0]=s|t<<22,this._data[3*e+1]=i,this._data[3*e+2]=o}addCodepointToCell(e,s){let t=this._data[3*e+0];2097152&t?this._combined[e]+=(0,d.stringFromCodePoint)(s):(2097151&t?(this._combined[e]=(0,d.stringFromCodePoint)(2097151&t)+(0,d.stringFromCodePoint)(s),t&=-2097152,t|=2097152):t=s|4194304,this._data[3*e+0]=t)}insertCells(e,s,t,i){if((e%=this.length)&&this.getWidth(e-1)===2&&this.setCellFromCodePoint(e-1,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs),s<this.length-e){let o=new u.CellData;for(let c=this.length-e-s-1;c>=0;--c)this.setCell(e+s+c,this.loadCell(e+c,o));for(let c=0;c<s;++c)this.setCell(e+c,t)}else for(let o=e;o<this.length;++o)this.setCell(o,t);this.getWidth(this.length-1)===2&&this.setCellFromCodePoint(this.length-1,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs)}deleteCells(e,s,t,i){if(e%=this.length,s<this.length-e){let o=new u.CellData;for(let c=0;c<this.length-e-s;++c)this.setCell(e+c,this.loadCell(e+s+c,o));for(let c=this.length-s;c<this.length;++c)this.setCell(c,t)}else for(let o=e;o<this.length;++o)this.setCell(o,t);e&&this.getWidth(e-1)===2&&this.setCellFromCodePoint(e-1,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs),this.getWidth(e)!==0||this.hasContent(e)||this.setCellFromCodePoint(e,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs)}replaceCells(e,s,t,i,o=!1){if(o)for(e&&this.getWidth(e-1)===2&&!this.isProtected(e-1)&&this.setCellFromCodePoint(e-1,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs),s<this.length&&this.getWidth(s-1)===2&&!this.isProtected(s)&&this.setCellFromCodePoint(s,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs);e<s&&e<this.length;)this.isProtected(e)||this.setCell(e,t),e++;else for(e&&this.getWidth(e-1)===2&&this.setCellFromCodePoint(e-1,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs),s<this.length&&this.getWidth(s-1)===2&&this.setCellFromCodePoint(s,0,1,i?.fg||0,i?.bg||0,i?.extended||new l.ExtendedAttrs);e<s&&e<this.length;)this.setCell(e++,t)}resize(e,s){if(e===this.length)return 4*this._data.length*2<this._data.buffer.byteLength;let t=3*e;if(e>this.length){if(this._data.buffer.byteLength>=4*t)this._data=new Uint32Array(this._data.buffer,0,t);else{let i=new Uint32Array(t);i.set(this._data),this._data=i}for(let i=this.length;i<e;++i)this.setCell(i,s)}else{this._data=this._data.subarray(0,t);let i=Object.keys(this._combined);for(let c=0;c<i.length;c++){let v=parseInt(i[c],10);v>=e&&delete this._combined[v]}let o=Object.keys(this._extendedAttrs);for(let c=0;c<o.length;c++){let v=parseInt(o[c],10);v>=e&&delete this._extendedAttrs[v]}}return this.length=e,4*t*2<this._data.buffer.byteLength}cleanupMemory(){if(4*this._data.length*2<this._data.buffer.byteLength){let e=new Uint32Array(this._data.length);return e.set(this._data),this._data=e,1}return 0}fill(e,s=!1){if(s)for(let t=0;t<this.length;++t)this.isProtected(t)||this.setCell(t,e);else{this._combined={},this._extendedAttrs={};for(let t=0;t<this.length;++t)this.setCell(t,e)}}copyFrom(e){this.length!==e.length?this._data=new Uint32Array(e._data):this._data.set(e._data),this.length=e.length,this._combined={};for(let s in e._combined)this._combined[s]=e._combined[s];this._extendedAttrs={};for(let s in e._extendedAttrs)this._extendedAttrs[s]=e._extendedAttrs[s];this.isWrapped=e.isWrapped}clone(){let e=new p(0);e._data=new Uint32Array(this._data),e.length=this.length;for(let s in this._combined)e._combined[s]=this._combined[s];for(let s in this._extendedAttrs)e._extendedAttrs[s]=this._extendedAttrs[s];return e.isWrapped=this.isWrapped,e}getTrimmedLength(){for(let e=this.length-1;e>=0;--e)if(4194303&this._data[3*e+0])return e+(this._data[3*e+0]>>22);return 0}getNoBgTrimmedLength(){for(let e=this.length-1;e>=0;--e)if(4194303&this._data[3*e+0]||50331648&this._data[3*e+2])return e+(this._data[3*e+0]>>22);return 0}copyCellsFrom(e,s,t,i,o){let c=e._data;if(o)for(let m=i-1;m>=0;m--){for(let h=0;h<3;h++)this._data[3*(t+m)+h]=c[3*(s+m)+h];268435456&c[3*(s+m)+2]&&(this._extendedAttrs[t+m]=e._extendedAttrs[s+m])}else for(let m=0;m<i;m++){for(let h=0;h<3;h++)this._data[3*(t+m)+h]=c[3*(s+m)+h];268435456&c[3*(s+m)+2]&&(this._extendedAttrs[t+m]=e._extendedAttrs[s+m])}let v=Object.keys(e._combined);for(let m=0;m<v.length;m++){let h=parseInt(v[m],10);h>=s&&(this._combined[h-s+t]=e._combined[h])}}translateToString(e=!1,s=0,t=this.length){e&&(t=Math.min(t,this.getTrimmedLength()));let i="";for(;s<t;){let o=this._data[3*s+0],c=2097151&o;i+=2097152&o?this._combined[s]:c?(0,d.stringFromCodePoint)(c):n.WHITESPACE_CELL_CHAR,s+=o>>22||1}return i}}r.BufferLine=p},4841:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.getRangeLength=void 0,r.getRangeLength=function(a,l){if(a.start.y>a.end.y)throw new Error(`Buffer range end (${a.end.x}, ${a.end.y}) cannot be before start (${a.start.x}, ${a.start.y})`);return l*(a.end.y-a.start.y)+(a.end.x-a.start.x+1)}},4634:(O,r)=>{function a(l,u,n){if(u===l.length-1)return l[u].getTrimmedLength();let d=!l[u].hasContent(n-1)&&l[u].getWidth(n-1)===1,f=l[u+1].getWidth(0)===2;return d&&f?n-1:n}Object.defineProperty(r,"__esModule",{value:!0}),r.getWrappedLineTrimmedLength=r.reflowSmallerGetNewLineLengths=r.reflowLargerApplyNewLayout=r.reflowLargerCreateNewLayout=r.reflowLargerGetLinesToRemove=void 0,r.reflowLargerGetLinesToRemove=function(l,u,n,d,f){let p=[];for(let _=0;_<l.length-1;_++){let e=_,s=l.get(++e);if(!s.isWrapped)continue;let t=[l.get(_)];for(;e<l.length&&s.isWrapped;)t.push(s),s=l.get(++e);if(d>=_&&d<e){_+=t.length-1;continue}let i=0,o=a(t,i,u),c=1,v=0;for(;c<t.length;){let h=a(t,c,u),g=h-v,b=n-o,L=Math.min(g,b);t[i].copyCellsFrom(t[c],v,o,L,!1),o+=L,o===n&&(i++,o=0),v+=L,v===h&&(c++,v=0),o===0&&i!==0&&t[i-1].getWidth(n-1)===2&&(t[i].copyCellsFrom(t[i-1],n-1,o++,1,!1),t[i-1].setCell(n-1,f))}t[i].replaceCells(o,n,f);let m=0;for(let h=t.length-1;h>0&&(h>i||t[h].getTrimmedLength()===0);h--)m++;m>0&&(p.push(_+t.length-m),p.push(m)),_+=t.length-1}return p},r.reflowLargerCreateNewLayout=function(l,u){let n=[],d=0,f=u[d],p=0;for(let _=0;_<l.length;_++)if(f===_){let e=u[++d];l.onDeleteEmitter.fire({index:_-p,amount:e}),_+=e-1,p+=e,f=u[++d]}else n.push(_);return{layout:n,countRemoved:p}},r.reflowLargerApplyNewLayout=function(l,u){let n=[];for(let d=0;d<u.length;d++)n.push(l.get(u[d]));for(let d=0;d<n.length;d++)l.set(d,n[d]);l.length=u.length},r.reflowSmallerGetNewLineLengths=function(l,u,n){let d=[],f=l.map(((s,t)=>a(l,t,u))).reduce(((s,t)=>s+t)),p=0,_=0,e=0;for(;e<f;){if(f-e<n){d.push(f-e);break}p+=n;let s=a(l,_,u);p>s&&(p-=s,_++);let t=l[_].getWidth(p-1)===2;t&&p--;let i=t?n-1:n;d.push(i),e+=i}return d},r.getWrappedLineTrimmedLength=a},5295:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.BufferSet=void 0;let l=a(8460),u=a(844),n=a(9092);class d extends u.Disposable{constructor(p,_){super(),this._optionsService=p,this._bufferService=_,this._onBufferActivate=this.register(new l.EventEmitter),this.onBufferActivate=this._onBufferActivate.event,this.reset(),this.register(this._optionsService.onSpecificOptionChange("scrollback",(()=>this.resize(this._bufferService.cols,this._bufferService.rows)))),this.register(this._optionsService.onSpecificOptionChange("tabStopWidth",(()=>this.setupTabStops())))}reset(){this._normal=new n.Buffer(!0,this._optionsService,this._bufferService),this._normal.fillViewportRows(),this._alt=new n.Buffer(!1,this._optionsService,this._bufferService),this._activeBuffer=this._normal,this._onBufferActivate.fire({activeBuffer:this._normal,inactiveBuffer:this._alt}),this.setupTabStops()}get alt(){return this._alt}get active(){return this._activeBuffer}get normal(){return this._normal}activateNormalBuffer(){this._activeBuffer!==this._normal&&(this._normal.x=this._alt.x,this._normal.y=this._alt.y,this._alt.clearAllMarkers(),this._alt.clear(),this._activeBuffer=this._normal,this._onBufferActivate.fire({activeBuffer:this._normal,inactiveBuffer:this._alt}))}activateAltBuffer(p){this._activeBuffer!==this._alt&&(this._alt.fillViewportRows(p),this._alt.x=this._normal.x,this._alt.y=this._normal.y,this._activeBuffer=this._alt,this._onBufferActivate.fire({activeBuffer:this._alt,inactiveBuffer:this._normal}))}resize(p,_){this._normal.resize(p,_),this._alt.resize(p,_),this.setupTabStops(p)}setupTabStops(p){this._normal.setupTabStops(p),this._alt.setupTabStops(p)}}r.BufferSet=d},511:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.CellData=void 0;let l=a(482),u=a(643),n=a(3734);class d extends n.AttributeData{constructor(){super(...arguments),this.content=0,this.fg=0,this.bg=0,this.extended=new n.ExtendedAttrs,this.combinedData=""}static fromCharData(p){let _=new d;return _.setFromCharData(p),_}isCombined(){return 2097152&this.content}getWidth(){return this.content>>22}getChars(){return 2097152&this.content?this.combinedData:2097151&this.content?(0,l.stringFromCodePoint)(2097151&this.content):""}getCode(){return this.isCombined()?this.combinedData.charCodeAt(this.combinedData.length-1):2097151&this.content}setFromCharData(p){this.fg=p[u.CHAR_DATA_ATTR_INDEX],this.bg=0;let _=!1;if(p[u.CHAR_DATA_CHAR_INDEX].length>2)_=!0;else if(p[u.CHAR_DATA_CHAR_INDEX].length===2){let e=p[u.CHAR_DATA_CHAR_INDEX].charCodeAt(0);if(55296<=e&&e<=56319){let s=p[u.CHAR_DATA_CHAR_INDEX].charCodeAt(1);56320<=s&&s<=57343?this.content=1024*(e-55296)+s-56320+65536|p[u.CHAR_DATA_WIDTH_INDEX]<<22:_=!0}else _=!0}else this.content=p[u.CHAR_DATA_CHAR_INDEX].charCodeAt(0)|p[u.CHAR_DATA_WIDTH_INDEX]<<22;_&&(this.combinedData=p[u.CHAR_DATA_CHAR_INDEX],this.content=2097152|p[u.CHAR_DATA_WIDTH_INDEX]<<22)}getAsCharData(){return[this.fg,this.getChars(),this.getWidth(),this.getCode()]}}r.CellData=d},643:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.WHITESPACE_CELL_CODE=r.WHITESPACE_CELL_WIDTH=r.WHITESPACE_CELL_CHAR=r.NULL_CELL_CODE=r.NULL_CELL_WIDTH=r.NULL_CELL_CHAR=r.CHAR_DATA_CODE_INDEX=r.CHAR_DATA_WIDTH_INDEX=r.CHAR_DATA_CHAR_INDEX=r.CHAR_DATA_ATTR_INDEX=r.DEFAULT_EXT=r.DEFAULT_ATTR=r.DEFAULT_COLOR=void 0,r.DEFAULT_COLOR=0,r.DEFAULT_ATTR=256|r.DEFAULT_COLOR<<9,r.DEFAULT_EXT=0,r.CHAR_DATA_ATTR_INDEX=0,r.CHAR_DATA_CHAR_INDEX=1,r.CHAR_DATA_WIDTH_INDEX=2,r.CHAR_DATA_CODE_INDEX=3,r.NULL_CELL_CHAR="",r.NULL_CELL_WIDTH=1,r.NULL_CELL_CODE=0,r.WHITESPACE_CELL_CHAR=" ",r.WHITESPACE_CELL_WIDTH=1,r.WHITESPACE_CELL_CODE=32},4863:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.Marker=void 0;let l=a(8460),u=a(844);class n{get id(){return this._id}constructor(f){this.line=f,this.isDisposed=!1,this._disposables=[],this._id=n._nextId++,this._onDispose=this.register(new l.EventEmitter),this.onDispose=this._onDispose.event}dispose(){this.isDisposed||(this.isDisposed=!0,this.line=-1,this._onDispose.fire(),(0,u.disposeArray)(this._disposables),this._disposables.length=0)}register(f){return this._disposables.push(f),f}}r.Marker=n,n._nextId=1},7116:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.DEFAULT_CHARSET=r.CHARSETS=void 0,r.CHARSETS={},r.DEFAULT_CHARSET=r.CHARSETS.B,r.CHARSETS[0]={"`":"\u25C6",a:"\u2592",b:"\u2409",c:"\u240C",d:"\u240D",e:"\u240A",f:"\xB0",g:"\xB1",h:"\u2424",i:"\u240B",j:"\u2518",k:"\u2510",l:"\u250C",m:"\u2514",n:"\u253C",o:"\u23BA",p:"\u23BB",q:"\u2500",r:"\u23BC",s:"\u23BD",t:"\u251C",u:"\u2524",v:"\u2534",w:"\u252C",x:"\u2502",y:"\u2264",z:"\u2265","{":"\u03C0","|":"\u2260","}":"\xA3","~":"\xB7"},r.CHARSETS.A={"#":"\xA3"},r.CHARSETS.B=void 0,r.CHARSETS[4]={"#":"\xA3","@":"\xBE","[":"ij","\\":"\xBD","]":"|","{":"\xA8","|":"f","}":"\xBC","~":"\xB4"},r.CHARSETS.C=r.CHARSETS[5]={"[":"\xC4","\\":"\xD6","]":"\xC5","^":"\xDC","`":"\xE9","{":"\xE4","|":"\xF6","}":"\xE5","~":"\xFC"},r.CHARSETS.R={"#":"\xA3","@":"\xE0","[":"\xB0","\\":"\xE7","]":"\xA7","{":"\xE9","|":"\xF9","}":"\xE8","~":"\xA8"},r.CHARSETS.Q={"@":"\xE0","[":"\xE2","\\":"\xE7","]":"\xEA","^":"\xEE","`":"\xF4","{":"\xE9","|":"\xF9","}":"\xE8","~":"\xFB"},r.CHARSETS.K={"@":"\xA7","[":"\xC4","\\":"\xD6","]":"\xDC","{":"\xE4","|":"\xF6","}":"\xFC","~":"\xDF"},r.CHARSETS.Y={"#":"\xA3","@":"\xA7","[":"\xB0","\\":"\xE7","]":"\xE9","`":"\xF9","{":"\xE0","|":"\xF2","}":"\xE8","~":"\xEC"},r.CHARSETS.E=r.CHARSETS[6]={"@":"\xC4","[":"\xC6","\\":"\xD8","]":"\xC5","^":"\xDC","`":"\xE4","{":"\xE6","|":"\xF8","}":"\xE5","~":"\xFC"},r.CHARSETS.Z={"#":"\xA3","@":"\xA7","[":"\xA1","\\":"\xD1","]":"\xBF","{":"\xB0","|":"\xF1","}":"\xE7"},r.CHARSETS.H=r.CHARSETS[7]={"@":"\xC9","[":"\xC4","\\":"\xD6","]":"\xC5","^":"\xDC","`":"\xE9","{":"\xE4","|":"\xF6","}":"\xE5","~":"\xFC"},r.CHARSETS["="]={"#":"\xF9","@":"\xE0","[":"\xE9","\\":"\xE7","]":"\xEA","^":"\xEE",_:"\xE8","`":"\xF4","{":"\xE4","|":"\xF6","}":"\xFC","~":"\xFB"}},2584:(O,r)=>{var a,l,u;Object.defineProperty(r,"__esModule",{value:!0}),r.C1_ESCAPED=r.C1=r.C0=void 0,(function(n){n.NUL="\0",n.SOH="",n.STX="",n.ETX="",n.EOT="",n.ENQ="",n.ACK="",n.BEL="\x07",n.BS="\b",n.HT="	",n.LF=`
`,n.VT="\v",n.FF="\f",n.CR="\r",n.SO="",n.SI="",n.DLE="",n.DC1="",n.DC2="",n.DC3="",n.DC4="",n.NAK="",n.SYN="",n.ETB="",n.CAN="",n.EM="",n.SUB="",n.ESC="\x1B",n.FS="",n.GS="",n.RS="",n.US="",n.SP=" ",n.DEL="\x7F"})(a||(r.C0=a={})),(function(n){n.PAD="\x80",n.HOP="\x81",n.BPH="\x82",n.NBH="\x83",n.IND="\x84",n.NEL="\x85",n.SSA="\x86",n.ESA="\x87",n.HTS="\x88",n.HTJ="\x89",n.VTS="\x8A",n.PLD="\x8B",n.PLU="\x8C",n.RI="\x8D",n.SS2="\x8E",n.SS3="\x8F",n.DCS="\x90",n.PU1="\x91",n.PU2="\x92",n.STS="\x93",n.CCH="\x94",n.MW="\x95",n.SPA="\x96",n.EPA="\x97",n.SOS="\x98",n.SGCI="\x99",n.SCI="\x9A",n.CSI="\x9B",n.ST="\x9C",n.OSC="\x9D",n.PM="\x9E",n.APC="\x9F"})(l||(r.C1=l={})),(function(n){n.ST=`${a.ESC}\\`})(u||(r.C1_ESCAPED=u={}))},7399:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.evaluateKeyboardEvent=void 0;let l=a(2584),u={48:["0",")"],49:["1","!"],50:["2","@"],51:["3","#"],52:["4","$"],53:["5","%"],54:["6","^"],55:["7","&"],56:["8","*"],57:["9","("],186:[";",":"],187:["=","+"],188:[",","<"],189:["-","_"],190:[".",">"],191:["/","?"],192:["`","~"],219:["[","{"],220:["\\","|"],221:["]","}"],222:["'",'"']};r.evaluateKeyboardEvent=function(n,d,f,p){let _={type:0,cancel:!1,key:void 0},e=(n.shiftKey?1:0)|(n.altKey?2:0)|(n.ctrlKey?4:0)|(n.metaKey?8:0);switch(n.keyCode){case 0:n.key==="UIKeyInputUpArrow"?_.key=d?l.C0.ESC+"OA":l.C0.ESC+"[A":n.key==="UIKeyInputLeftArrow"?_.key=d?l.C0.ESC+"OD":l.C0.ESC+"[D":n.key==="UIKeyInputRightArrow"?_.key=d?l.C0.ESC+"OC":l.C0.ESC+"[C":n.key==="UIKeyInputDownArrow"&&(_.key=d?l.C0.ESC+"OB":l.C0.ESC+"[B");break;case 8:if(n.altKey){_.key=l.C0.ESC+l.C0.DEL;break}_.key=l.C0.DEL;break;case 9:if(n.shiftKey){_.key=l.C0.ESC+"[Z";break}_.key=l.C0.HT,_.cancel=!0;break;case 13:_.key=n.altKey?l.C0.ESC+l.C0.CR:l.C0.CR,_.cancel=!0;break;case 27:_.key=l.C0.ESC,n.altKey&&(_.key=l.C0.ESC+l.C0.ESC),_.cancel=!0;break;case 37:if(n.metaKey)break;e?(_.key=l.C0.ESC+"[1;"+(e+1)+"D",_.key===l.C0.ESC+"[1;3D"&&(_.key=l.C0.ESC+(f?"b":"[1;5D"))):_.key=d?l.C0.ESC+"OD":l.C0.ESC+"[D";break;case 39:if(n.metaKey)break;e?(_.key=l.C0.ESC+"[1;"+(e+1)+"C",_.key===l.C0.ESC+"[1;3C"&&(_.key=l.C0.ESC+(f?"f":"[1;5C"))):_.key=d?l.C0.ESC+"OC":l.C0.ESC+"[C";break;case 38:if(n.metaKey)break;e?(_.key=l.C0.ESC+"[1;"+(e+1)+"A",f||_.key!==l.C0.ESC+"[1;3A"||(_.key=l.C0.ESC+"[1;5A")):_.key=d?l.C0.ESC+"OA":l.C0.ESC+"[A";break;case 40:if(n.metaKey)break;e?(_.key=l.C0.ESC+"[1;"+(e+1)+"B",f||_.key!==l.C0.ESC+"[1;3B"||(_.key=l.C0.ESC+"[1;5B")):_.key=d?l.C0.ESC+"OB":l.C0.ESC+"[B";break;case 45:n.shiftKey||n.ctrlKey||(_.key=l.C0.ESC+"[2~");break;case 46:_.key=e?l.C0.ESC+"[3;"+(e+1)+"~":l.C0.ESC+"[3~";break;case 36:_.key=e?l.C0.ESC+"[1;"+(e+1)+"H":d?l.C0.ESC+"OH":l.C0.ESC+"[H";break;case 35:_.key=e?l.C0.ESC+"[1;"+(e+1)+"F":d?l.C0.ESC+"OF":l.C0.ESC+"[F";break;case 33:n.shiftKey?_.type=2:n.ctrlKey?_.key=l.C0.ESC+"[5;"+(e+1)+"~":_.key=l.C0.ESC+"[5~";break;case 34:n.shiftKey?_.type=3:n.ctrlKey?_.key=l.C0.ESC+"[6;"+(e+1)+"~":_.key=l.C0.ESC+"[6~";break;case 112:_.key=e?l.C0.ESC+"[1;"+(e+1)+"P":l.C0.ESC+"OP";break;case 113:_.key=e?l.C0.ESC+"[1;"+(e+1)+"Q":l.C0.ESC+"OQ";break;case 114:_.key=e?l.C0.ESC+"[1;"+(e+1)+"R":l.C0.ESC+"OR";break;case 115:_.key=e?l.C0.ESC+"[1;"+(e+1)+"S":l.C0.ESC+"OS";break;case 116:_.key=e?l.C0.ESC+"[15;"+(e+1)+"~":l.C0.ESC+"[15~";break;case 117:_.key=e?l.C0.ESC+"[17;"+(e+1)+"~":l.C0.ESC+"[17~";break;case 118:_.key=e?l.C0.ESC+"[18;"+(e+1)+"~":l.C0.ESC+"[18~";break;case 119:_.key=e?l.C0.ESC+"[19;"+(e+1)+"~":l.C0.ESC+"[19~";break;case 120:_.key=e?l.C0.ESC+"[20;"+(e+1)+"~":l.C0.ESC+"[20~";break;case 121:_.key=e?l.C0.ESC+"[21;"+(e+1)+"~":l.C0.ESC+"[21~";break;case 122:_.key=e?l.C0.ESC+"[23;"+(e+1)+"~":l.C0.ESC+"[23~";break;case 123:_.key=e?l.C0.ESC+"[24;"+(e+1)+"~":l.C0.ESC+"[24~";break;default:if(!n.ctrlKey||n.shiftKey||n.altKey||n.metaKey)if(f&&!p||!n.altKey||n.metaKey)!f||n.altKey||n.ctrlKey||n.shiftKey||!n.metaKey?n.key&&!n.ctrlKey&&!n.altKey&&!n.metaKey&&n.keyCode>=48&&n.key.length===1?_.key=n.key:n.key&&n.ctrlKey&&(n.key==="_"&&(_.key=l.C0.US),n.key==="@"&&(_.key=l.C0.NUL)):n.keyCode===65&&(_.type=1);else{let s=u[n.keyCode],t=s?.[n.shiftKey?1:0];if(t)_.key=l.C0.ESC+t;else if(n.keyCode>=65&&n.keyCode<=90){let i=n.ctrlKey?n.keyCode-64:n.keyCode+32,o=String.fromCharCode(i);n.shiftKey&&(o=o.toUpperCase()),_.key=l.C0.ESC+o}else if(n.keyCode===32)_.key=l.C0.ESC+(n.ctrlKey?l.C0.NUL:" ");else if(n.key==="Dead"&&n.code.startsWith("Key")){let i=n.code.slice(3,4);n.shiftKey||(i=i.toLowerCase()),_.key=l.C0.ESC+i,_.cancel=!0}}else n.keyCode>=65&&n.keyCode<=90?_.key=String.fromCharCode(n.keyCode-64):n.keyCode===32?_.key=l.C0.NUL:n.keyCode>=51&&n.keyCode<=55?_.key=String.fromCharCode(n.keyCode-51+27):n.keyCode===56?_.key=l.C0.DEL:n.keyCode===219?_.key=l.C0.ESC:n.keyCode===220?_.key=l.C0.FS:n.keyCode===221&&(_.key=l.C0.GS)}return _}},482:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.Utf8ToUtf32=r.StringToUtf32=r.utf32ToString=r.stringFromCodePoint=void 0,r.stringFromCodePoint=function(a){return a>65535?(a-=65536,String.fromCharCode(55296+(a>>10))+String.fromCharCode(a%1024+56320)):String.fromCharCode(a)},r.utf32ToString=function(a,l=0,u=a.length){let n="";for(let d=l;d<u;++d){let f=a[d];f>65535?(f-=65536,n+=String.fromCharCode(55296+(f>>10))+String.fromCharCode(f%1024+56320)):n+=String.fromCharCode(f)}return n},r.StringToUtf32=class{constructor(){this._interim=0}clear(){this._interim=0}decode(a,l){let u=a.length;if(!u)return 0;let n=0,d=0;if(this._interim){let f=a.charCodeAt(d++);56320<=f&&f<=57343?l[n++]=1024*(this._interim-55296)+f-56320+65536:(l[n++]=this._interim,l[n++]=f),this._interim=0}for(let f=d;f<u;++f){let p=a.charCodeAt(f);if(55296<=p&&p<=56319){if(++f>=u)return this._interim=p,n;let _=a.charCodeAt(f);56320<=_&&_<=57343?l[n++]=1024*(p-55296)+_-56320+65536:(l[n++]=p,l[n++]=_)}else p!==65279&&(l[n++]=p)}return n}},r.Utf8ToUtf32=class{constructor(){this.interim=new Uint8Array(3)}clear(){this.interim.fill(0)}decode(a,l){let u=a.length;if(!u)return 0;let n,d,f,p,_=0,e=0,s=0;if(this.interim[0]){let o=!1,c=this.interim[0];c&=(224&c)==192?31:(240&c)==224?15:7;let v,m=0;for(;(v=63&this.interim[++m])&&m<4;)c<<=6,c|=v;let h=(224&this.interim[0])==192?2:(240&this.interim[0])==224?3:4,g=h-m;for(;s<g;){if(s>=u)return 0;if(v=a[s++],(192&v)!=128){s--,o=!0;break}this.interim[m++]=v,c<<=6,c|=63&v}o||(h===2?c<128?s--:l[_++]=c:h===3?c<2048||c>=55296&&c<=57343||c===65279||(l[_++]=c):c<65536||c>1114111||(l[_++]=c)),this.interim.fill(0)}let t=u-4,i=s;for(;i<u;){for(;!(!(i<t)||128&(n=a[i])||128&(d=a[i+1])||128&(f=a[i+2])||128&(p=a[i+3]));)l[_++]=n,l[_++]=d,l[_++]=f,l[_++]=p,i+=4;if(n=a[i++],n<128)l[_++]=n;else if((224&n)==192){if(i>=u)return this.interim[0]=n,_;if(d=a[i++],(192&d)!=128){i--;continue}if(e=(31&n)<<6|63&d,e<128){i--;continue}l[_++]=e}else if((240&n)==224){if(i>=u)return this.interim[0]=n,_;if(d=a[i++],(192&d)!=128){i--;continue}if(i>=u)return this.interim[0]=n,this.interim[1]=d,_;if(f=a[i++],(192&f)!=128){i--;continue}if(e=(15&n)<<12|(63&d)<<6|63&f,e<2048||e>=55296&&e<=57343||e===65279)continue;l[_++]=e}else if((248&n)==240){if(i>=u)return this.interim[0]=n,_;if(d=a[i++],(192&d)!=128){i--;continue}if(i>=u)return this.interim[0]=n,this.interim[1]=d,_;if(f=a[i++],(192&f)!=128){i--;continue}if(i>=u)return this.interim[0]=n,this.interim[1]=d,this.interim[2]=f,_;if(p=a[i++],(192&p)!=128){i--;continue}if(e=(7&n)<<18|(63&d)<<12|(63&f)<<6|63&p,e<65536||e>1114111)continue;l[_++]=e}}return _}}},225:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.UnicodeV6=void 0;let a=[[768,879],[1155,1158],[1160,1161],[1425,1469],[1471,1471],[1473,1474],[1476,1477],[1479,1479],[1536,1539],[1552,1557],[1611,1630],[1648,1648],[1750,1764],[1767,1768],[1770,1773],[1807,1807],[1809,1809],[1840,1866],[1958,1968],[2027,2035],[2305,2306],[2364,2364],[2369,2376],[2381,2381],[2385,2388],[2402,2403],[2433,2433],[2492,2492],[2497,2500],[2509,2509],[2530,2531],[2561,2562],[2620,2620],[2625,2626],[2631,2632],[2635,2637],[2672,2673],[2689,2690],[2748,2748],[2753,2757],[2759,2760],[2765,2765],[2786,2787],[2817,2817],[2876,2876],[2879,2879],[2881,2883],[2893,2893],[2902,2902],[2946,2946],[3008,3008],[3021,3021],[3134,3136],[3142,3144],[3146,3149],[3157,3158],[3260,3260],[3263,3263],[3270,3270],[3276,3277],[3298,3299],[3393,3395],[3405,3405],[3530,3530],[3538,3540],[3542,3542],[3633,3633],[3636,3642],[3655,3662],[3761,3761],[3764,3769],[3771,3772],[3784,3789],[3864,3865],[3893,3893],[3895,3895],[3897,3897],[3953,3966],[3968,3972],[3974,3975],[3984,3991],[3993,4028],[4038,4038],[4141,4144],[4146,4146],[4150,4151],[4153,4153],[4184,4185],[4448,4607],[4959,4959],[5906,5908],[5938,5940],[5970,5971],[6002,6003],[6068,6069],[6071,6077],[6086,6086],[6089,6099],[6109,6109],[6155,6157],[6313,6313],[6432,6434],[6439,6440],[6450,6450],[6457,6459],[6679,6680],[6912,6915],[6964,6964],[6966,6970],[6972,6972],[6978,6978],[7019,7027],[7616,7626],[7678,7679],[8203,8207],[8234,8238],[8288,8291],[8298,8303],[8400,8431],[12330,12335],[12441,12442],[43014,43014],[43019,43019],[43045,43046],[64286,64286],[65024,65039],[65056,65059],[65279,65279],[65529,65531]],l=[[68097,68099],[68101,68102],[68108,68111],[68152,68154],[68159,68159],[119143,119145],[119155,119170],[119173,119179],[119210,119213],[119362,119364],[917505,917505],[917536,917631],[917760,917999]],u;r.UnicodeV6=class{constructor(){if(this.version="6",!u){u=new Uint8Array(65536),u.fill(1),u[0]=0,u.fill(0,1,32),u.fill(0,127,160),u.fill(2,4352,4448),u[9001]=2,u[9002]=2,u.fill(2,11904,42192),u[12351]=1,u.fill(2,44032,55204),u.fill(2,63744,64256),u.fill(2,65040,65050),u.fill(2,65072,65136),u.fill(2,65280,65377),u.fill(2,65504,65511);for(let n=0;n<a.length;++n)u.fill(0,a[n][0],a[n][1]+1)}}wcwidth(n){return n<32?0:n<127?1:n<65536?u[n]:(function(d,f){let p,_=0,e=f.length-1;if(d<f[0][0]||d>f[e][1])return!1;for(;e>=_;)if(p=_+e>>1,d>f[p][1])_=p+1;else{if(!(d<f[p][0]))return!0;e=p-1}return!1})(n,l)?0:n>=131072&&n<=196605||n>=196608&&n<=262141?2:1}}},5981:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.WriteBuffer=void 0;let l=a(8460),u=a(844);class n extends u.Disposable{constructor(f){super(),this._action=f,this._writeBuffer=[],this._callbacks=[],this._pendingData=0,this._bufferOffset=0,this._isSyncWriting=!1,this._syncCalls=0,this._didUserInput=!1,this._onWriteParsed=this.register(new l.EventEmitter),this.onWriteParsed=this._onWriteParsed.event}handleUserInput(){this._didUserInput=!0}writeSync(f,p){if(p!==void 0&&this._syncCalls>p)return void(this._syncCalls=0);if(this._pendingData+=f.length,this._writeBuffer.push(f),this._callbacks.push(void 0),this._syncCalls++,this._isSyncWriting)return;let _;for(this._isSyncWriting=!0;_=this._writeBuffer.shift();){this._action(_);let e=this._callbacks.shift();e&&e()}this._pendingData=0,this._bufferOffset=2147483647,this._isSyncWriting=!1,this._syncCalls=0}write(f,p){if(this._pendingData>5e7)throw new Error("write data discarded, use flow control to avoid losing data");if(!this._writeBuffer.length){if(this._bufferOffset=0,this._didUserInput)return this._didUserInput=!1,this._pendingData+=f.length,this._writeBuffer.push(f),this._callbacks.push(p),void this._innerWrite();setTimeout((()=>this._innerWrite()))}this._pendingData+=f.length,this._writeBuffer.push(f),this._callbacks.push(p)}_innerWrite(f=0,p=!0){let _=f||Date.now();for(;this._writeBuffer.length>this._bufferOffset;){let e=this._writeBuffer[this._bufferOffset],s=this._action(e,p);if(s){let i=o=>Date.now()-_>=12?setTimeout((()=>this._innerWrite(0,o))):this._innerWrite(_,o);return void s.catch((o=>(queueMicrotask((()=>{throw o})),Promise.resolve(!1)))).then(i)}let t=this._callbacks[this._bufferOffset];if(t&&t(),this._bufferOffset++,this._pendingData-=e.length,Date.now()-_>=12)break}this._writeBuffer.length>this._bufferOffset?(this._bufferOffset>50&&(this._writeBuffer=this._writeBuffer.slice(this._bufferOffset),this._callbacks=this._callbacks.slice(this._bufferOffset),this._bufferOffset=0),setTimeout((()=>this._innerWrite()))):(this._writeBuffer.length=0,this._callbacks.length=0,this._pendingData=0,this._bufferOffset=0),this._onWriteParsed.fire()}}r.WriteBuffer=n},5941:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.toRgbString=r.parseColor=void 0;let a=/^([\da-f])\/([\da-f])\/([\da-f])$|^([\da-f]{2})\/([\da-f]{2})\/([\da-f]{2})$|^([\da-f]{3})\/([\da-f]{3})\/([\da-f]{3})$|^([\da-f]{4})\/([\da-f]{4})\/([\da-f]{4})$/,l=/^[\da-f]+$/;function u(n,d){let f=n.toString(16),p=f.length<2?"0"+f:f;switch(d){case 4:return f[0];case 8:return p;case 12:return(p+p).slice(0,3);default:return p+p}}r.parseColor=function(n){if(!n)return;let d=n.toLowerCase();if(d.indexOf("rgb:")===0){d=d.slice(4);let f=a.exec(d);if(f){let p=f[1]?15:f[4]?255:f[7]?4095:65535;return[Math.round(parseInt(f[1]||f[4]||f[7]||f[10],16)/p*255),Math.round(parseInt(f[2]||f[5]||f[8]||f[11],16)/p*255),Math.round(parseInt(f[3]||f[6]||f[9]||f[12],16)/p*255)]}}else if(d.indexOf("#")===0&&(d=d.slice(1),l.exec(d)&&[3,6,9,12].includes(d.length))){let f=d.length/3,p=[0,0,0];for(let _=0;_<3;++_){let e=parseInt(d.slice(f*_,f*_+f),16);p[_]=f===1?e<<4:f===2?e:f===3?e>>4:e>>8}return p}},r.toRgbString=function(n,d=16){let[f,p,_]=n;return`rgb:${u(f,d)}/${u(p,d)}/${u(_,d)}`}},5770:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.PAYLOAD_LIMIT=void 0,r.PAYLOAD_LIMIT=1e7},6351:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.DcsHandler=r.DcsParser=void 0;let l=a(482),u=a(8742),n=a(5770),d=[];r.DcsParser=class{constructor(){this._handlers=Object.create(null),this._active=d,this._ident=0,this._handlerFb=()=>{},this._stack={paused:!1,loopPosition:0,fallThrough:!1}}dispose(){this._handlers=Object.create(null),this._handlerFb=()=>{},this._active=d}registerHandler(p,_){this._handlers[p]===void 0&&(this._handlers[p]=[]);let e=this._handlers[p];return e.push(_),{dispose:()=>{let s=e.indexOf(_);s!==-1&&e.splice(s,1)}}}clearHandler(p){this._handlers[p]&&delete this._handlers[p]}setHandlerFallback(p){this._handlerFb=p}reset(){if(this._active.length)for(let p=this._stack.paused?this._stack.loopPosition-1:this._active.length-1;p>=0;--p)this._active[p].unhook(!1);this._stack.paused=!1,this._active=d,this._ident=0}hook(p,_){if(this.reset(),this._ident=p,this._active=this._handlers[p]||d,this._active.length)for(let e=this._active.length-1;e>=0;e--)this._active[e].hook(_);else this._handlerFb(this._ident,"HOOK",_)}put(p,_,e){if(this._active.length)for(let s=this._active.length-1;s>=0;s--)this._active[s].put(p,_,e);else this._handlerFb(this._ident,"PUT",(0,l.utf32ToString)(p,_,e))}unhook(p,_=!0){if(this._active.length){let e=!1,s=this._active.length-1,t=!1;if(this._stack.paused&&(s=this._stack.loopPosition-1,e=_,t=this._stack.fallThrough,this._stack.paused=!1),!t&&e===!1){for(;s>=0&&(e=this._active[s].unhook(p),e!==!0);s--)if(e instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=s,this._stack.fallThrough=!1,e;s--}for(;s>=0;s--)if(e=this._active[s].unhook(!1),e instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=s,this._stack.fallThrough=!0,e}else this._handlerFb(this._ident,"UNHOOK",p);this._active=d,this._ident=0}};let f=new u.Params;f.addParam(0),r.DcsHandler=class{constructor(p){this._handler=p,this._data="",this._params=f,this._hitLimit=!1}hook(p){this._params=p.length>1||p.params[0]?p.clone():f,this._data="",this._hitLimit=!1}put(p,_,e){this._hitLimit||(this._data+=(0,l.utf32ToString)(p,_,e),this._data.length>n.PAYLOAD_LIMIT&&(this._data="",this._hitLimit=!0))}unhook(p){let _=!1;if(this._hitLimit)_=!1;else if(p&&(_=this._handler(this._data,this._params),_ instanceof Promise))return _.then((e=>(this._params=f,this._data="",this._hitLimit=!1,e)));return this._params=f,this._data="",this._hitLimit=!1,_}}},2015:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.EscapeSequenceParser=r.VT500_TRANSITION_TABLE=r.TransitionTable=void 0;let l=a(844),u=a(8742),n=a(6242),d=a(6351);class f{constructor(s){this.table=new Uint8Array(s)}setDefault(s,t){this.table.fill(s<<4|t)}add(s,t,i,o){this.table[t<<8|s]=i<<4|o}addMany(s,t,i,o){for(let c=0;c<s.length;c++)this.table[t<<8|s[c]]=i<<4|o}}r.TransitionTable=f;let p=160;r.VT500_TRANSITION_TABLE=(function(){let e=new f(4095),s=Array.apply(null,Array(256)).map(((m,h)=>h)),t=(m,h)=>s.slice(m,h),i=t(32,127),o=t(0,24);o.push(25),o.push.apply(o,t(28,32));let c=t(0,14),v;for(v in e.setDefault(1,0),e.addMany(i,0,2,0),c)e.addMany([24,26,153,154],v,3,0),e.addMany(t(128,144),v,3,0),e.addMany(t(144,152),v,3,0),e.add(156,v,0,0),e.add(27,v,11,1),e.add(157,v,4,8),e.addMany([152,158,159],v,0,7),e.add(155,v,11,3),e.add(144,v,11,9);return e.addMany(o,0,3,0),e.addMany(o,1,3,1),e.add(127,1,0,1),e.addMany(o,8,0,8),e.addMany(o,3,3,3),e.add(127,3,0,3),e.addMany(o,4,3,4),e.add(127,4,0,4),e.addMany(o,6,3,6),e.addMany(o,5,3,5),e.add(127,5,0,5),e.addMany(o,2,3,2),e.add(127,2,0,2),e.add(93,1,4,8),e.addMany(i,8,5,8),e.add(127,8,5,8),e.addMany([156,27,24,26,7],8,6,0),e.addMany(t(28,32),8,0,8),e.addMany([88,94,95],1,0,7),e.addMany(i,7,0,7),e.addMany(o,7,0,7),e.add(156,7,0,0),e.add(127,7,0,7),e.add(91,1,11,3),e.addMany(t(64,127),3,7,0),e.addMany(t(48,60),3,8,4),e.addMany([60,61,62,63],3,9,4),e.addMany(t(48,60),4,8,4),e.addMany(t(64,127),4,7,0),e.addMany([60,61,62,63],4,0,6),e.addMany(t(32,64),6,0,6),e.add(127,6,0,6),e.addMany(t(64,127),6,0,0),e.addMany(t(32,48),3,9,5),e.addMany(t(32,48),5,9,5),e.addMany(t(48,64),5,0,6),e.addMany(t(64,127),5,7,0),e.addMany(t(32,48),4,9,5),e.addMany(t(32,48),1,9,2),e.addMany(t(32,48),2,9,2),e.addMany(t(48,127),2,10,0),e.addMany(t(48,80),1,10,0),e.addMany(t(81,88),1,10,0),e.addMany([89,90,92],1,10,0),e.addMany(t(96,127),1,10,0),e.add(80,1,11,9),e.addMany(o,9,0,9),e.add(127,9,0,9),e.addMany(t(28,32),9,0,9),e.addMany(t(32,48),9,9,12),e.addMany(t(48,60),9,8,10),e.addMany([60,61,62,63],9,9,10),e.addMany(o,11,0,11),e.addMany(t(32,128),11,0,11),e.addMany(t(28,32),11,0,11),e.addMany(o,10,0,10),e.add(127,10,0,10),e.addMany(t(28,32),10,0,10),e.addMany(t(48,60),10,8,10),e.addMany([60,61,62,63],10,0,11),e.addMany(t(32,48),10,9,12),e.addMany(o,12,0,12),e.add(127,12,0,12),e.addMany(t(28,32),12,0,12),e.addMany(t(32,48),12,9,12),e.addMany(t(48,64),12,0,11),e.addMany(t(64,127),12,12,13),e.addMany(t(64,127),10,12,13),e.addMany(t(64,127),9,12,13),e.addMany(o,13,13,13),e.addMany(i,13,13,13),e.add(127,13,0,13),e.addMany([27,156,24,26],13,14,0),e.add(p,0,2,0),e.add(p,8,5,8),e.add(p,6,0,6),e.add(p,11,0,11),e.add(p,13,13,13),e})();class _ extends l.Disposable{constructor(s=r.VT500_TRANSITION_TABLE){super(),this._transitions=s,this._parseStack={state:0,handlers:[],handlerPos:0,transition:0,chunkPos:0},this.initialState=0,this.currentState=this.initialState,this._params=new u.Params,this._params.addParam(0),this._collect=0,this.precedingCodepoint=0,this._printHandlerFb=(t,i,o)=>{},this._executeHandlerFb=t=>{},this._csiHandlerFb=(t,i)=>{},this._escHandlerFb=t=>{},this._errorHandlerFb=t=>t,this._printHandler=this._printHandlerFb,this._executeHandlers=Object.create(null),this._csiHandlers=Object.create(null),this._escHandlers=Object.create(null),this.register((0,l.toDisposable)((()=>{this._csiHandlers=Object.create(null),this._executeHandlers=Object.create(null),this._escHandlers=Object.create(null)}))),this._oscParser=this.register(new n.OscParser),this._dcsParser=this.register(new d.DcsParser),this._errorHandler=this._errorHandlerFb,this.registerEscHandler({final:"\\"},(()=>!0))}_identifier(s,t=[64,126]){let i=0;if(s.prefix){if(s.prefix.length>1)throw new Error("only one byte as prefix supported");if(i=s.prefix.charCodeAt(0),i&&60>i||i>63)throw new Error("prefix must be in range 0x3c .. 0x3f")}if(s.intermediates){if(s.intermediates.length>2)throw new Error("only two bytes as intermediates are supported");for(let c=0;c<s.intermediates.length;++c){let v=s.intermediates.charCodeAt(c);if(32>v||v>47)throw new Error("intermediate must be in range 0x20 .. 0x2f");i<<=8,i|=v}}if(s.final.length!==1)throw new Error("final must be a single byte");let o=s.final.charCodeAt(0);if(t[0]>o||o>t[1])throw new Error(`final must be in range ${t[0]} .. ${t[1]}`);return i<<=8,i|=o,i}identToString(s){let t=[];for(;s;)t.push(String.fromCharCode(255&s)),s>>=8;return t.reverse().join("")}setPrintHandler(s){this._printHandler=s}clearPrintHandler(){this._printHandler=this._printHandlerFb}registerEscHandler(s,t){let i=this._identifier(s,[48,126]);this._escHandlers[i]===void 0&&(this._escHandlers[i]=[]);let o=this._escHandlers[i];return o.push(t),{dispose:()=>{let c=o.indexOf(t);c!==-1&&o.splice(c,1)}}}clearEscHandler(s){this._escHandlers[this._identifier(s,[48,126])]&&delete this._escHandlers[this._identifier(s,[48,126])]}setEscHandlerFallback(s){this._escHandlerFb=s}setExecuteHandler(s,t){this._executeHandlers[s.charCodeAt(0)]=t}clearExecuteHandler(s){this._executeHandlers[s.charCodeAt(0)]&&delete this._executeHandlers[s.charCodeAt(0)]}setExecuteHandlerFallback(s){this._executeHandlerFb=s}registerCsiHandler(s,t){let i=this._identifier(s);this._csiHandlers[i]===void 0&&(this._csiHandlers[i]=[]);let o=this._csiHandlers[i];return o.push(t),{dispose:()=>{let c=o.indexOf(t);c!==-1&&o.splice(c,1)}}}clearCsiHandler(s){this._csiHandlers[this._identifier(s)]&&delete this._csiHandlers[this._identifier(s)]}setCsiHandlerFallback(s){this._csiHandlerFb=s}registerDcsHandler(s,t){return this._dcsParser.registerHandler(this._identifier(s),t)}clearDcsHandler(s){this._dcsParser.clearHandler(this._identifier(s))}setDcsHandlerFallback(s){this._dcsParser.setHandlerFallback(s)}registerOscHandler(s,t){return this._oscParser.registerHandler(s,t)}clearOscHandler(s){this._oscParser.clearHandler(s)}setOscHandlerFallback(s){this._oscParser.setHandlerFallback(s)}setErrorHandler(s){this._errorHandler=s}clearErrorHandler(){this._errorHandler=this._errorHandlerFb}reset(){this.currentState=this.initialState,this._oscParser.reset(),this._dcsParser.reset(),this._params.reset(),this._params.addParam(0),this._collect=0,this.precedingCodepoint=0,this._parseStack.state!==0&&(this._parseStack.state=2,this._parseStack.handlers=[])}_preserveStack(s,t,i,o,c){this._parseStack.state=s,this._parseStack.handlers=t,this._parseStack.handlerPos=i,this._parseStack.transition=o,this._parseStack.chunkPos=c}parse(s,t,i){let o,c=0,v=0,m=0;if(this._parseStack.state)if(this._parseStack.state===2)this._parseStack.state=0,m=this._parseStack.chunkPos+1;else{if(i===void 0||this._parseStack.state===1)throw this._parseStack.state=1,new Error("improper continuation due to previous async handler, giving up parsing");let h=this._parseStack.handlers,g=this._parseStack.handlerPos-1;switch(this._parseStack.state){case 3:if(i===!1&&g>-1){for(;g>=0&&(o=h[g](this._params),o!==!0);g--)if(o instanceof Promise)return this._parseStack.handlerPos=g,o}this._parseStack.handlers=[];break;case 4:if(i===!1&&g>-1){for(;g>=0&&(o=h[g](),o!==!0);g--)if(o instanceof Promise)return this._parseStack.handlerPos=g,o}this._parseStack.handlers=[];break;case 6:if(c=s[this._parseStack.chunkPos],o=this._dcsParser.unhook(c!==24&&c!==26,i),o)return o;c===27&&(this._parseStack.transition|=1),this._params.reset(),this._params.addParam(0),this._collect=0;break;case 5:if(c=s[this._parseStack.chunkPos],o=this._oscParser.end(c!==24&&c!==26,i),o)return o;c===27&&(this._parseStack.transition|=1),this._params.reset(),this._params.addParam(0),this._collect=0}this._parseStack.state=0,m=this._parseStack.chunkPos+1,this.precedingCodepoint=0,this.currentState=15&this._parseStack.transition}for(let h=m;h<t;++h){switch(c=s[h],v=this._transitions.table[this.currentState<<8|(c<160?c:p)],v>>4){case 2:for(let k=h+1;;++k){if(k>=t||(c=s[k])<32||c>126&&c<p){this._printHandler(s,h,k),h=k-1;break}if(++k>=t||(c=s[k])<32||c>126&&c<p){this._printHandler(s,h,k),h=k-1;break}if(++k>=t||(c=s[k])<32||c>126&&c<p){this._printHandler(s,h,k),h=k-1;break}if(++k>=t||(c=s[k])<32||c>126&&c<p){this._printHandler(s,h,k),h=k-1;break}}break;case 3:this._executeHandlers[c]?this._executeHandlers[c]():this._executeHandlerFb(c),this.precedingCodepoint=0;break;case 0:break;case 1:if(this._errorHandler({position:h,code:c,currentState:this.currentState,collect:this._collect,params:this._params,abort:!1}).abort)return;break;case 7:let g=this._csiHandlers[this._collect<<8|c],b=g?g.length-1:-1;for(;b>=0&&(o=g[b](this._params),o!==!0);b--)if(o instanceof Promise)return this._preserveStack(3,g,b,v,h),o;b<0&&this._csiHandlerFb(this._collect<<8|c,this._params),this.precedingCodepoint=0;break;case 8:do switch(c){case 59:this._params.addParam(0);break;case 58:this._params.addSubParam(-1);break;default:this._params.addDigit(c-48)}while(++h<t&&(c=s[h])>47&&c<60);h--;break;case 9:this._collect<<=8,this._collect|=c;break;case 10:let L=this._escHandlers[this._collect<<8|c],y=L?L.length-1:-1;for(;y>=0&&(o=L[y](),o!==!0);y--)if(o instanceof Promise)return this._preserveStack(4,L,y,v,h),o;y<0&&this._escHandlerFb(this._collect<<8|c),this.precedingCodepoint=0;break;case 11:this._params.reset(),this._params.addParam(0),this._collect=0;break;case 12:this._dcsParser.hook(this._collect<<8|c,this._params);break;case 13:for(let k=h+1;;++k)if(k>=t||(c=s[k])===24||c===26||c===27||c>127&&c<p){this._dcsParser.put(s,h,k),h=k-1;break}break;case 14:if(o=this._dcsParser.unhook(c!==24&&c!==26),o)return this._preserveStack(6,[],0,v,h),o;c===27&&(v|=1),this._params.reset(),this._params.addParam(0),this._collect=0,this.precedingCodepoint=0;break;case 4:this._oscParser.start();break;case 5:for(let k=h+1;;k++)if(k>=t||(c=s[k])<32||c>127&&c<p){this._oscParser.put(s,h,k),h=k-1;break}break;case 6:if(o=this._oscParser.end(c!==24&&c!==26),o)return this._preserveStack(5,[],0,v,h),o;c===27&&(v|=1),this._params.reset(),this._params.addParam(0),this._collect=0,this.precedingCodepoint=0}this.currentState=15&v}}}r.EscapeSequenceParser=_},6242:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.OscHandler=r.OscParser=void 0;let l=a(5770),u=a(482),n=[];r.OscParser=class{constructor(){this._state=0,this._active=n,this._id=-1,this._handlers=Object.create(null),this._handlerFb=()=>{},this._stack={paused:!1,loopPosition:0,fallThrough:!1}}registerHandler(d,f){this._handlers[d]===void 0&&(this._handlers[d]=[]);let p=this._handlers[d];return p.push(f),{dispose:()=>{let _=p.indexOf(f);_!==-1&&p.splice(_,1)}}}clearHandler(d){this._handlers[d]&&delete this._handlers[d]}setHandlerFallback(d){this._handlerFb=d}dispose(){this._handlers=Object.create(null),this._handlerFb=()=>{},this._active=n}reset(){if(this._state===2)for(let d=this._stack.paused?this._stack.loopPosition-1:this._active.length-1;d>=0;--d)this._active[d].end(!1);this._stack.paused=!1,this._active=n,this._id=-1,this._state=0}_start(){if(this._active=this._handlers[this._id]||n,this._active.length)for(let d=this._active.length-1;d>=0;d--)this._active[d].start();else this._handlerFb(this._id,"START")}_put(d,f,p){if(this._active.length)for(let _=this._active.length-1;_>=0;_--)this._active[_].put(d,f,p);else this._handlerFb(this._id,"PUT",(0,u.utf32ToString)(d,f,p))}start(){this.reset(),this._state=1}put(d,f,p){if(this._state!==3){if(this._state===1)for(;f<p;){let _=d[f++];if(_===59){this._state=2,this._start();break}if(_<48||57<_)return void(this._state=3);this._id===-1&&(this._id=0),this._id=10*this._id+_-48}this._state===2&&p-f>0&&this._put(d,f,p)}}end(d,f=!0){if(this._state!==0){if(this._state!==3)if(this._state===1&&this._start(),this._active.length){let p=!1,_=this._active.length-1,e=!1;if(this._stack.paused&&(_=this._stack.loopPosition-1,p=f,e=this._stack.fallThrough,this._stack.paused=!1),!e&&p===!1){for(;_>=0&&(p=this._active[_].end(d),p!==!0);_--)if(p instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=_,this._stack.fallThrough=!1,p;_--}for(;_>=0;_--)if(p=this._active[_].end(!1),p instanceof Promise)return this._stack.paused=!0,this._stack.loopPosition=_,this._stack.fallThrough=!0,p}else this._handlerFb(this._id,"END",d);this._active=n,this._id=-1,this._state=0}}},r.OscHandler=class{constructor(d){this._handler=d,this._data="",this._hitLimit=!1}start(){this._data="",this._hitLimit=!1}put(d,f,p){this._hitLimit||(this._data+=(0,u.utf32ToString)(d,f,p),this._data.length>l.PAYLOAD_LIMIT&&(this._data="",this._hitLimit=!0))}end(d){let f=!1;if(this._hitLimit)f=!1;else if(d&&(f=this._handler(this._data),f instanceof Promise))return f.then((p=>(this._data="",this._hitLimit=!1,p)));return this._data="",this._hitLimit=!1,f}}},8742:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.Params=void 0;let a=2147483647;class l{static fromArray(n){let d=new l;if(!n.length)return d;for(let f=Array.isArray(n[0])?1:0;f<n.length;++f){let p=n[f];if(Array.isArray(p))for(let _=0;_<p.length;++_)d.addSubParam(p[_]);else d.addParam(p)}return d}constructor(n=32,d=32){if(this.maxLength=n,this.maxSubParamsLength=d,d>256)throw new Error("maxSubParamsLength must not be greater than 256");this.params=new Int32Array(n),this.length=0,this._subParams=new Int32Array(d),this._subParamsLength=0,this._subParamsIdx=new Uint16Array(n),this._rejectDigits=!1,this._rejectSubDigits=!1,this._digitIsSub=!1}clone(){let n=new l(this.maxLength,this.maxSubParamsLength);return n.params.set(this.params),n.length=this.length,n._subParams.set(this._subParams),n._subParamsLength=this._subParamsLength,n._subParamsIdx.set(this._subParamsIdx),n._rejectDigits=this._rejectDigits,n._rejectSubDigits=this._rejectSubDigits,n._digitIsSub=this._digitIsSub,n}toArray(){let n=[];for(let d=0;d<this.length;++d){n.push(this.params[d]);let f=this._subParamsIdx[d]>>8,p=255&this._subParamsIdx[d];p-f>0&&n.push(Array.prototype.slice.call(this._subParams,f,p))}return n}reset(){this.length=0,this._subParamsLength=0,this._rejectDigits=!1,this._rejectSubDigits=!1,this._digitIsSub=!1}addParam(n){if(this._digitIsSub=!1,this.length>=this.maxLength)this._rejectDigits=!0;else{if(n<-1)throw new Error("values lesser than -1 are not allowed");this._subParamsIdx[this.length]=this._subParamsLength<<8|this._subParamsLength,this.params[this.length++]=n>a?a:n}}addSubParam(n){if(this._digitIsSub=!0,this.length)if(this._rejectDigits||this._subParamsLength>=this.maxSubParamsLength)this._rejectSubDigits=!0;else{if(n<-1)throw new Error("values lesser than -1 are not allowed");this._subParams[this._subParamsLength++]=n>a?a:n,this._subParamsIdx[this.length-1]++}}hasSubParams(n){return(255&this._subParamsIdx[n])-(this._subParamsIdx[n]>>8)>0}getSubParams(n){let d=this._subParamsIdx[n]>>8,f=255&this._subParamsIdx[n];return f-d>0?this._subParams.subarray(d,f):null}getSubParamsAll(){let n={};for(let d=0;d<this.length;++d){let f=this._subParamsIdx[d]>>8,p=255&this._subParamsIdx[d];p-f>0&&(n[d]=this._subParams.slice(f,p))}return n}addDigit(n){let d;if(this._rejectDigits||!(d=this._digitIsSub?this._subParamsLength:this.length)||this._digitIsSub&&this._rejectSubDigits)return;let f=this._digitIsSub?this._subParams:this.params,p=f[d-1];f[d-1]=~p?Math.min(10*p+n,a):n}}r.Params=l},5741:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.AddonManager=void 0,r.AddonManager=class{constructor(){this._addons=[]}dispose(){for(let a=this._addons.length-1;a>=0;a--)this._addons[a].instance.dispose()}loadAddon(a,l){let u={instance:l,dispose:l.dispose,isDisposed:!1};this._addons.push(u),l.dispose=()=>this._wrappedAddonDispose(u),l.activate(a)}_wrappedAddonDispose(a){if(a.isDisposed)return;let l=-1;for(let u=0;u<this._addons.length;u++)if(this._addons[u]===a){l=u;break}if(l===-1)throw new Error("Could not dispose an addon that has not been loaded");a.isDisposed=!0,a.dispose.apply(a.instance),this._addons.splice(l,1)}}},8771:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.BufferApiView=void 0;let l=a(3785),u=a(511);r.BufferApiView=class{constructor(n,d){this._buffer=n,this.type=d}init(n){return this._buffer=n,this}get cursorY(){return this._buffer.y}get cursorX(){return this._buffer.x}get viewportY(){return this._buffer.ydisp}get baseY(){return this._buffer.ybase}get length(){return this._buffer.lines.length}getLine(n){let d=this._buffer.lines.get(n);if(d)return new l.BufferLineApiView(d)}getNullCell(){return new u.CellData}}},3785:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.BufferLineApiView=void 0;let l=a(511);r.BufferLineApiView=class{constructor(u){this._line=u}get isWrapped(){return this._line.isWrapped}get length(){return this._line.length}getCell(u,n){if(!(u<0||u>=this._line.length))return n?(this._line.loadCell(u,n),n):this._line.loadCell(u,new l.CellData)}translateToString(u,n,d){return this._line.translateToString(u,n,d)}}},8285:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.BufferNamespaceApi=void 0;let l=a(8771),u=a(8460),n=a(844);class d extends n.Disposable{constructor(p){super(),this._core=p,this._onBufferChange=this.register(new u.EventEmitter),this.onBufferChange=this._onBufferChange.event,this._normal=new l.BufferApiView(this._core.buffers.normal,"normal"),this._alternate=new l.BufferApiView(this._core.buffers.alt,"alternate"),this._core.buffers.onBufferActivate((()=>this._onBufferChange.fire(this.active)))}get active(){if(this._core.buffers.active===this._core.buffers.normal)return this.normal;if(this._core.buffers.active===this._core.buffers.alt)return this.alternate;throw new Error("Active buffer is neither normal nor alternate")}get normal(){return this._normal.init(this._core.buffers.normal)}get alternate(){return this._alternate.init(this._core.buffers.alt)}}r.BufferNamespaceApi=d},7975:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.ParserApi=void 0,r.ParserApi=class{constructor(a){this._core=a}registerCsiHandler(a,l){return this._core.registerCsiHandler(a,(u=>l(u.toArray())))}addCsiHandler(a,l){return this.registerCsiHandler(a,l)}registerDcsHandler(a,l){return this._core.registerDcsHandler(a,((u,n)=>l(u,n.toArray())))}addDcsHandler(a,l){return this.registerDcsHandler(a,l)}registerEscHandler(a,l){return this._core.registerEscHandler(a,l)}addEscHandler(a,l){return this.registerEscHandler(a,l)}registerOscHandler(a,l){return this._core.registerOscHandler(a,l)}addOscHandler(a,l){return this.registerOscHandler(a,l)}}},7090:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.UnicodeApi=void 0,r.UnicodeApi=class{constructor(a){this._core=a}register(a){this._core.unicodeService.register(a)}get versions(){return this._core.unicodeService.versions}get activeVersion(){return this._core.unicodeService.activeVersion}set activeVersion(a){this._core.unicodeService.activeVersion=a}}},744:function(O,r,a){var l=this&&this.__decorate||function(e,s,t,i){var o,c=arguments.length,v=c<3?s:i===null?i=Object.getOwnPropertyDescriptor(s,t):i;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")v=Reflect.decorate(e,s,t,i);else for(var m=e.length-1;m>=0;m--)(o=e[m])&&(v=(c<3?o(v):c>3?o(s,t,v):o(s,t))||v);return c>3&&v&&Object.defineProperty(s,t,v),v},u=this&&this.__param||function(e,s){return function(t,i){s(t,i,e)}};Object.defineProperty(r,"__esModule",{value:!0}),r.BufferService=r.MINIMUM_ROWS=r.MINIMUM_COLS=void 0;let n=a(8460),d=a(844),f=a(5295),p=a(2585);r.MINIMUM_COLS=2,r.MINIMUM_ROWS=1;let _=r.BufferService=class extends d.Disposable{get buffer(){return this.buffers.active}constructor(e){super(),this.isUserScrolling=!1,this._onResize=this.register(new n.EventEmitter),this.onResize=this._onResize.event,this._onScroll=this.register(new n.EventEmitter),this.onScroll=this._onScroll.event,this.cols=Math.max(e.rawOptions.cols||0,r.MINIMUM_COLS),this.rows=Math.max(e.rawOptions.rows||0,r.MINIMUM_ROWS),this.buffers=this.register(new f.BufferSet(e,this))}resize(e,s){this.cols=e,this.rows=s,this.buffers.resize(e,s),this._onResize.fire({cols:e,rows:s})}reset(){this.buffers.reset(),this.isUserScrolling=!1}scroll(e,s=!1){let t=this.buffer,i;i=this._cachedBlankLine,i&&i.length===this.cols&&i.getFg(0)===e.fg&&i.getBg(0)===e.bg||(i=t.getBlankLine(e,s),this._cachedBlankLine=i),i.isWrapped=s;let o=t.ybase+t.scrollTop,c=t.ybase+t.scrollBottom;if(t.scrollTop===0){let v=t.lines.isFull;c===t.lines.length-1?v?t.lines.recycle().copyFrom(i):t.lines.push(i.clone()):t.lines.splice(c+1,0,i.clone()),v?this.isUserScrolling&&(t.ydisp=Math.max(t.ydisp-1,0)):(t.ybase++,this.isUserScrolling||t.ydisp++)}else{let v=c-o+1;t.lines.shiftElements(o+1,v-1,-1),t.lines.set(c,i.clone())}this.isUserScrolling||(t.ydisp=t.ybase),this._onScroll.fire(t.ydisp)}scrollLines(e,s,t){let i=this.buffer;if(e<0){if(i.ydisp===0)return;this.isUserScrolling=!0}else e+i.ydisp>=i.ybase&&(this.isUserScrolling=!1);let o=i.ydisp;i.ydisp=Math.max(Math.min(i.ydisp+e,i.ybase),0),o!==i.ydisp&&(s||this._onScroll.fire(i.ydisp))}};r.BufferService=_=l([u(0,p.IOptionsService)],_)},7994:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.CharsetService=void 0,r.CharsetService=class{constructor(){this.glevel=0,this._charsets=[]}reset(){this.charset=void 0,this._charsets=[],this.glevel=0}setgLevel(a){this.glevel=a,this.charset=this._charsets[a]}setgCharset(a,l){this._charsets[a]=l,this.glevel===a&&(this.charset=l)}}},1753:function(O,r,a){var l=this&&this.__decorate||function(i,o,c,v){var m,h=arguments.length,g=h<3?o:v===null?v=Object.getOwnPropertyDescriptor(o,c):v;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")g=Reflect.decorate(i,o,c,v);else for(var b=i.length-1;b>=0;b--)(m=i[b])&&(g=(h<3?m(g):h>3?m(o,c,g):m(o,c))||g);return h>3&&g&&Object.defineProperty(o,c,g),g},u=this&&this.__param||function(i,o){return function(c,v){o(c,v,i)}};Object.defineProperty(r,"__esModule",{value:!0}),r.CoreMouseService=void 0;let n=a(2585),d=a(8460),f=a(844),p={NONE:{events:0,restrict:()=>!1},X10:{events:1,restrict:i=>i.button!==4&&i.action===1&&(i.ctrl=!1,i.alt=!1,i.shift=!1,!0)},VT200:{events:19,restrict:i=>i.action!==32},DRAG:{events:23,restrict:i=>i.action!==32||i.button!==3},ANY:{events:31,restrict:i=>!0}};function _(i,o){let c=(i.ctrl?16:0)|(i.shift?4:0)|(i.alt?8:0);return i.button===4?(c|=64,c|=i.action):(c|=3&i.button,4&i.button&&(c|=64),8&i.button&&(c|=128),i.action===32?c|=32:i.action!==0||o||(c|=3)),c}let e=String.fromCharCode,s={DEFAULT:i=>{let o=[_(i,!1)+32,i.col+32,i.row+32];return o[0]>255||o[1]>255||o[2]>255?"":`\x1B[M${e(o[0])}${e(o[1])}${e(o[2])}`},SGR:i=>{let o=i.action===0&&i.button!==4?"m":"M";return`\x1B[<${_(i,!0)};${i.col};${i.row}${o}`},SGR_PIXELS:i=>{let o=i.action===0&&i.button!==4?"m":"M";return`\x1B[<${_(i,!0)};${i.x};${i.y}${o}`}},t=r.CoreMouseService=class extends f.Disposable{constructor(i,o){super(),this._bufferService=i,this._coreService=o,this._protocols={},this._encodings={},this._activeProtocol="",this._activeEncoding="",this._lastEvent=null,this._onProtocolChange=this.register(new d.EventEmitter),this.onProtocolChange=this._onProtocolChange.event;for(let c of Object.keys(p))this.addProtocol(c,p[c]);for(let c of Object.keys(s))this.addEncoding(c,s[c]);this.reset()}addProtocol(i,o){this._protocols[i]=o}addEncoding(i,o){this._encodings[i]=o}get activeProtocol(){return this._activeProtocol}get areMouseEventsActive(){return this._protocols[this._activeProtocol].events!==0}set activeProtocol(i){if(!this._protocols[i])throw new Error(`unknown protocol "${i}"`);this._activeProtocol=i,this._onProtocolChange.fire(this._protocols[i].events)}get activeEncoding(){return this._activeEncoding}set activeEncoding(i){if(!this._encodings[i])throw new Error(`unknown encoding "${i}"`);this._activeEncoding=i}reset(){this.activeProtocol="NONE",this.activeEncoding="DEFAULT",this._lastEvent=null}triggerMouseEvent(i){if(i.col<0||i.col>=this._bufferService.cols||i.row<0||i.row>=this._bufferService.rows||i.button===4&&i.action===32||i.button===3&&i.action!==32||i.button!==4&&(i.action===2||i.action===3)||(i.col++,i.row++,i.action===32&&this._lastEvent&&this._equalEvents(this._lastEvent,i,this._activeEncoding==="SGR_PIXELS"))||!this._protocols[this._activeProtocol].restrict(i))return!1;let o=this._encodings[this._activeEncoding](i);return o&&(this._activeEncoding==="DEFAULT"?this._coreService.triggerBinaryEvent(o):this._coreService.triggerDataEvent(o,!0)),this._lastEvent=i,!0}explainEvents(i){return{down:!!(1&i),up:!!(2&i),drag:!!(4&i),move:!!(8&i),wheel:!!(16&i)}}_equalEvents(i,o,c){if(c){if(i.x!==o.x||i.y!==o.y)return!1}else if(i.col!==o.col||i.row!==o.row)return!1;return i.button===o.button&&i.action===o.action&&i.ctrl===o.ctrl&&i.alt===o.alt&&i.shift===o.shift}};r.CoreMouseService=t=l([u(0,n.IBufferService),u(1,n.ICoreService)],t)},6975:function(O,r,a){var l=this&&this.__decorate||function(t,i,o,c){var v,m=arguments.length,h=m<3?i:c===null?c=Object.getOwnPropertyDescriptor(i,o):c;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")h=Reflect.decorate(t,i,o,c);else for(var g=t.length-1;g>=0;g--)(v=t[g])&&(h=(m<3?v(h):m>3?v(i,o,h):v(i,o))||h);return m>3&&h&&Object.defineProperty(i,o,h),h},u=this&&this.__param||function(t,i){return function(o,c){i(o,c,t)}};Object.defineProperty(r,"__esModule",{value:!0}),r.CoreService=void 0;let n=a(1439),d=a(8460),f=a(844),p=a(2585),_=Object.freeze({insertMode:!1}),e=Object.freeze({applicationCursorKeys:!1,applicationKeypad:!1,bracketedPasteMode:!1,origin:!1,reverseWraparound:!1,sendFocus:!1,wraparound:!0}),s=r.CoreService=class extends f.Disposable{constructor(t,i,o){super(),this._bufferService=t,this._logService=i,this._optionsService=o,this.isCursorInitialized=!1,this.isCursorHidden=!1,this._onData=this.register(new d.EventEmitter),this.onData=this._onData.event,this._onUserInput=this.register(new d.EventEmitter),this.onUserInput=this._onUserInput.event,this._onBinary=this.register(new d.EventEmitter),this.onBinary=this._onBinary.event,this._onRequestScrollToBottom=this.register(new d.EventEmitter),this.onRequestScrollToBottom=this._onRequestScrollToBottom.event,this.modes=(0,n.clone)(_),this.decPrivateModes=(0,n.clone)(e)}reset(){this.modes=(0,n.clone)(_),this.decPrivateModes=(0,n.clone)(e)}triggerDataEvent(t,i=!1){if(this._optionsService.rawOptions.disableStdin)return;let o=this._bufferService.buffer;i&&this._optionsService.rawOptions.scrollOnUserInput&&o.ybase!==o.ydisp&&this._onRequestScrollToBottom.fire(),i&&this._onUserInput.fire(),this._logService.debug(`sending data "${t}"`,(()=>t.split("").map((c=>c.charCodeAt(0))))),this._onData.fire(t)}triggerBinaryEvent(t){this._optionsService.rawOptions.disableStdin||(this._logService.debug(`sending binary "${t}"`,(()=>t.split("").map((i=>i.charCodeAt(0))))),this._onBinary.fire(t))}};r.CoreService=s=l([u(0,p.IBufferService),u(1,p.ILogService),u(2,p.IOptionsService)],s)},9074:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.DecorationService=void 0;let l=a(8055),u=a(8460),n=a(844),d=a(6106),f=0,p=0;class _ extends n.Disposable{get decorations(){return this._decorations.values()}constructor(){super(),this._decorations=new d.SortedList((t=>t?.marker.line)),this._onDecorationRegistered=this.register(new u.EventEmitter),this.onDecorationRegistered=this._onDecorationRegistered.event,this._onDecorationRemoved=this.register(new u.EventEmitter),this.onDecorationRemoved=this._onDecorationRemoved.event,this.register((0,n.toDisposable)((()=>this.reset())))}registerDecoration(t){if(t.marker.isDisposed)return;let i=new e(t);if(i){let o=i.marker.onDispose((()=>i.dispose()));i.onDispose((()=>{i&&(this._decorations.delete(i)&&this._onDecorationRemoved.fire(i),o.dispose())})),this._decorations.insert(i),this._onDecorationRegistered.fire(i)}return i}reset(){for(let t of this._decorations.values())t.dispose();this._decorations.clear()}*getDecorationsAtCell(t,i,o){var c,v,m;let h=0,g=0;for(let b of this._decorations.getKeyIterator(i))h=(c=b.options.x)!==null&&c!==void 0?c:0,g=h+((v=b.options.width)!==null&&v!==void 0?v:1),t>=h&&t<g&&(!o||((m=b.options.layer)!==null&&m!==void 0?m:"bottom")===o)&&(yield b)}forEachDecorationAtCell(t,i,o,c){this._decorations.forEachByKey(i,(v=>{var m,h,g;f=(m=v.options.x)!==null&&m!==void 0?m:0,p=f+((h=v.options.width)!==null&&h!==void 0?h:1),t>=f&&t<p&&(!o||((g=v.options.layer)!==null&&g!==void 0?g:"bottom")===o)&&c(v)}))}}r.DecorationService=_;class e extends n.Disposable{get isDisposed(){return this._isDisposed}get backgroundColorRGB(){return this._cachedBg===null&&(this.options.backgroundColor?this._cachedBg=l.css.toColor(this.options.backgroundColor):this._cachedBg=void 0),this._cachedBg}get foregroundColorRGB(){return this._cachedFg===null&&(this.options.foregroundColor?this._cachedFg=l.css.toColor(this.options.foregroundColor):this._cachedFg=void 0),this._cachedFg}constructor(t){super(),this.options=t,this.onRenderEmitter=this.register(new u.EventEmitter),this.onRender=this.onRenderEmitter.event,this._onDispose=this.register(new u.EventEmitter),this.onDispose=this._onDispose.event,this._cachedBg=null,this._cachedFg=null,this.marker=t.marker,this.options.overviewRulerOptions&&!this.options.overviewRulerOptions.position&&(this.options.overviewRulerOptions.position="full")}dispose(){this._onDispose.fire(),super.dispose()}}},4348:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.InstantiationService=r.ServiceCollection=void 0;let l=a(2585),u=a(8343);class n{constructor(...f){this._entries=new Map;for(let[p,_]of f)this.set(p,_)}set(f,p){let _=this._entries.get(f);return this._entries.set(f,p),_}forEach(f){for(let[p,_]of this._entries.entries())f(p,_)}has(f){return this._entries.has(f)}get(f){return this._entries.get(f)}}r.ServiceCollection=n,r.InstantiationService=class{constructor(){this._services=new n,this._services.set(l.IInstantiationService,this)}setService(d,f){this._services.set(d,f)}getService(d){return this._services.get(d)}createInstance(d,...f){let p=(0,u.getServiceDependencies)(d).sort(((s,t)=>s.index-t.index)),_=[];for(let s of p){let t=this._services.get(s.id);if(!t)throw new Error(`[createInstance] ${d.name} depends on UNKNOWN service ${s.id}.`);_.push(t)}let e=p.length>0?p[0].index:f.length;if(f.length!==e)throw new Error(`[createInstance] First service dependency of ${d.name} at position ${e+1} conflicts with ${f.length} static arguments`);return new d(...f,..._)}}},7866:function(O,r,a){var l=this&&this.__decorate||function(e,s,t,i){var o,c=arguments.length,v=c<3?s:i===null?i=Object.getOwnPropertyDescriptor(s,t):i;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")v=Reflect.decorate(e,s,t,i);else for(var m=e.length-1;m>=0;m--)(o=e[m])&&(v=(c<3?o(v):c>3?o(s,t,v):o(s,t))||v);return c>3&&v&&Object.defineProperty(s,t,v),v},u=this&&this.__param||function(e,s){return function(t,i){s(t,i,e)}};Object.defineProperty(r,"__esModule",{value:!0}),r.traceCall=r.setTraceLogger=r.LogService=void 0;let n=a(844),d=a(2585),f={trace:d.LogLevelEnum.TRACE,debug:d.LogLevelEnum.DEBUG,info:d.LogLevelEnum.INFO,warn:d.LogLevelEnum.WARN,error:d.LogLevelEnum.ERROR,off:d.LogLevelEnum.OFF},p,_=r.LogService=class extends n.Disposable{get logLevel(){return this._logLevel}constructor(e){super(),this._optionsService=e,this._logLevel=d.LogLevelEnum.OFF,this._updateLogLevel(),this.register(this._optionsService.onSpecificOptionChange("logLevel",(()=>this._updateLogLevel()))),p=this}_updateLogLevel(){this._logLevel=f[this._optionsService.rawOptions.logLevel]}_evalLazyOptionalParams(e){for(let s=0;s<e.length;s++)typeof e[s]=="function"&&(e[s]=e[s]())}_log(e,s,t){this._evalLazyOptionalParams(t),e.call(console,(this._optionsService.options.logger?"":"xterm.js: ")+s,...t)}trace(e,...s){var t,i;this._logLevel<=d.LogLevelEnum.TRACE&&this._log((i=(t=this._optionsService.options.logger)===null||t===void 0?void 0:t.trace.bind(this._optionsService.options.logger))!==null&&i!==void 0?i:console.log,e,s)}debug(e,...s){var t,i;this._logLevel<=d.LogLevelEnum.DEBUG&&this._log((i=(t=this._optionsService.options.logger)===null||t===void 0?void 0:t.debug.bind(this._optionsService.options.logger))!==null&&i!==void 0?i:console.log,e,s)}info(e,...s){var t,i;this._logLevel<=d.LogLevelEnum.INFO&&this._log((i=(t=this._optionsService.options.logger)===null||t===void 0?void 0:t.info.bind(this._optionsService.options.logger))!==null&&i!==void 0?i:console.info,e,s)}warn(e,...s){var t,i;this._logLevel<=d.LogLevelEnum.WARN&&this._log((i=(t=this._optionsService.options.logger)===null||t===void 0?void 0:t.warn.bind(this._optionsService.options.logger))!==null&&i!==void 0?i:console.warn,e,s)}error(e,...s){var t,i;this._logLevel<=d.LogLevelEnum.ERROR&&this._log((i=(t=this._optionsService.options.logger)===null||t===void 0?void 0:t.error.bind(this._optionsService.options.logger))!==null&&i!==void 0?i:console.error,e,s)}};r.LogService=_=l([u(0,d.IOptionsService)],_),r.setTraceLogger=function(e){p=e},r.traceCall=function(e,s,t){if(typeof t.value!="function")throw new Error("not supported");let i=t.value;t.value=function(...o){if(p.logLevel!==d.LogLevelEnum.TRACE)return i.apply(this,o);p.trace(`GlyphRenderer#${i.name}(${o.map((v=>JSON.stringify(v))).join(", ")})`);let c=i.apply(this,o);return p.trace(`GlyphRenderer#${i.name} return`,c),c}}},7302:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.OptionsService=r.DEFAULT_OPTIONS=void 0;let l=a(8460),u=a(844),n=a(6114);r.DEFAULT_OPTIONS={cols:80,rows:24,cursorBlink:!1,cursorStyle:"block",cursorWidth:1,cursorInactiveStyle:"outline",customGlyphs:!0,drawBoldTextInBrightColors:!0,fastScrollModifier:"alt",fastScrollSensitivity:5,fontFamily:"courier-new, courier, monospace",fontSize:15,fontWeight:"normal",fontWeightBold:"bold",ignoreBracketedPasteMode:!1,lineHeight:1,letterSpacing:0,linkHandler:null,logLevel:"info",logger:null,scrollback:1e3,scrollOnUserInput:!0,scrollSensitivity:1,screenReaderMode:!1,smoothScrollDuration:0,macOptionIsMeta:!1,macOptionClickForcesSelection:!1,minimumContrastRatio:1,disableStdin:!1,allowProposedApi:!1,allowTransparency:!1,tabStopWidth:8,theme:{},rightClickSelectsWord:n.isMac,windowOptions:{},windowsMode:!1,windowsPty:{},wordSeparator:" ()[]{}',\"`",altClickMovesCursor:!0,convertEol:!1,termName:"xterm",cancelEvents:!1,overviewRulerWidth:0};let d=["normal","bold","100","200","300","400","500","600","700","800","900"];class f extends u.Disposable{constructor(_){super(),this._onOptionChange=this.register(new l.EventEmitter),this.onOptionChange=this._onOptionChange.event;let e=Object.assign({},r.DEFAULT_OPTIONS);for(let s in _)if(s in e)try{let t=_[s];e[s]=this._sanitizeAndValidateOption(s,t)}catch(t){console.error(t)}this.rawOptions=e,this.options=Object.assign({},e),this._setupOptions()}onSpecificOptionChange(_,e){return this.onOptionChange((s=>{s===_&&e(this.rawOptions[_])}))}onMultipleOptionChange(_,e){return this.onOptionChange((s=>{_.indexOf(s)!==-1&&e()}))}_setupOptions(){let _=s=>{if(!(s in r.DEFAULT_OPTIONS))throw new Error(`No option with key "${s}"`);return this.rawOptions[s]},e=(s,t)=>{if(!(s in r.DEFAULT_OPTIONS))throw new Error(`No option with key "${s}"`);t=this._sanitizeAndValidateOption(s,t),this.rawOptions[s]!==t&&(this.rawOptions[s]=t,this._onOptionChange.fire(s))};for(let s in this.rawOptions){let t={get:_.bind(this,s),set:e.bind(this,s)};Object.defineProperty(this.options,s,t)}}_sanitizeAndValidateOption(_,e){switch(_){case"cursorStyle":if(e||(e=r.DEFAULT_OPTIONS[_]),!(function(s){return s==="block"||s==="underline"||s==="bar"})(e))throw new Error(`"${e}" is not a valid value for ${_}`);break;case"wordSeparator":e||(e=r.DEFAULT_OPTIONS[_]);break;case"fontWeight":case"fontWeightBold":if(typeof e=="number"&&1<=e&&e<=1e3)break;e=d.includes(e)?e:r.DEFAULT_OPTIONS[_];break;case"cursorWidth":e=Math.floor(e);case"lineHeight":case"tabStopWidth":if(e<1)throw new Error(`${_} cannot be less than 1, value: ${e}`);break;case"minimumContrastRatio":e=Math.max(1,Math.min(21,Math.round(10*e)/10));break;case"scrollback":if((e=Math.min(e,4294967295))<0)throw new Error(`${_} cannot be less than 0, value: ${e}`);break;case"fastScrollSensitivity":case"scrollSensitivity":if(e<=0)throw new Error(`${_} cannot be less than or equal to 0, value: ${e}`);break;case"rows":case"cols":if(!e&&e!==0)throw new Error(`${_} must be numeric, value: ${e}`);break;case"windowsPty":e=e??{}}return e}}r.OptionsService=f},2660:function(O,r,a){var l=this&&this.__decorate||function(f,p,_,e){var s,t=arguments.length,i=t<3?p:e===null?e=Object.getOwnPropertyDescriptor(p,_):e;if(typeof Reflect=="object"&&typeof Reflect.decorate=="function")i=Reflect.decorate(f,p,_,e);else for(var o=f.length-1;o>=0;o--)(s=f[o])&&(i=(t<3?s(i):t>3?s(p,_,i):s(p,_))||i);return t>3&&i&&Object.defineProperty(p,_,i),i},u=this&&this.__param||function(f,p){return function(_,e){p(_,e,f)}};Object.defineProperty(r,"__esModule",{value:!0}),r.OscLinkService=void 0;let n=a(2585),d=r.OscLinkService=class{constructor(f){this._bufferService=f,this._nextId=1,this._entriesWithId=new Map,this._dataByLinkId=new Map}registerLink(f){let p=this._bufferService.buffer;if(f.id===void 0){let o=p.addMarker(p.ybase+p.y),c={data:f,id:this._nextId++,lines:[o]};return o.onDispose((()=>this._removeMarkerFromLink(c,o))),this._dataByLinkId.set(c.id,c),c.id}let _=f,e=this._getEntryIdKey(_),s=this._entriesWithId.get(e);if(s)return this.addLineToLink(s.id,p.ybase+p.y),s.id;let t=p.addMarker(p.ybase+p.y),i={id:this._nextId++,key:this._getEntryIdKey(_),data:_,lines:[t]};return t.onDispose((()=>this._removeMarkerFromLink(i,t))),this._entriesWithId.set(i.key,i),this._dataByLinkId.set(i.id,i),i.id}addLineToLink(f,p){let _=this._dataByLinkId.get(f);if(_&&_.lines.every((e=>e.line!==p))){let e=this._bufferService.buffer.addMarker(p);_.lines.push(e),e.onDispose((()=>this._removeMarkerFromLink(_,e)))}}getLinkData(f){var p;return(p=this._dataByLinkId.get(f))===null||p===void 0?void 0:p.data}_getEntryIdKey(f){return`${f.id};;${f.uri}`}_removeMarkerFromLink(f,p){let _=f.lines.indexOf(p);_!==-1&&(f.lines.splice(_,1),f.lines.length===0&&(f.data.id!==void 0&&this._entriesWithId.delete(f.key),this._dataByLinkId.delete(f.id)))}};r.OscLinkService=d=l([u(0,n.IBufferService)],d)},8343:(O,r)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.createDecorator=r.getServiceDependencies=r.serviceRegistry=void 0;let a="di$target",l="di$dependencies";r.serviceRegistry=new Map,r.getServiceDependencies=function(u){return u[l]||[]},r.createDecorator=function(u){if(r.serviceRegistry.has(u))return r.serviceRegistry.get(u);let n=function(d,f,p){if(arguments.length!==3)throw new Error("@IServiceName-decorator can only be used to decorate a parameter");(function(_,e,s){e[a]===e?e[l].push({id:_,index:s}):(e[l]=[{id:_,index:s}],e[a]=e)})(n,d,p)};return n.toString=()=>u,r.serviceRegistry.set(u,n),n}},2585:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.IDecorationService=r.IUnicodeService=r.IOscLinkService=r.IOptionsService=r.ILogService=r.LogLevelEnum=r.IInstantiationService=r.ICharsetService=r.ICoreService=r.ICoreMouseService=r.IBufferService=void 0;let l=a(8343);var u;r.IBufferService=(0,l.createDecorator)("BufferService"),r.ICoreMouseService=(0,l.createDecorator)("CoreMouseService"),r.ICoreService=(0,l.createDecorator)("CoreService"),r.ICharsetService=(0,l.createDecorator)("CharsetService"),r.IInstantiationService=(0,l.createDecorator)("InstantiationService"),(function(n){n[n.TRACE=0]="TRACE",n[n.DEBUG=1]="DEBUG",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.OFF=5]="OFF"})(u||(r.LogLevelEnum=u={})),r.ILogService=(0,l.createDecorator)("LogService"),r.IOptionsService=(0,l.createDecorator)("OptionsService"),r.IOscLinkService=(0,l.createDecorator)("OscLinkService"),r.IUnicodeService=(0,l.createDecorator)("UnicodeService"),r.IDecorationService=(0,l.createDecorator)("DecorationService")},1480:(O,r,a)=>{Object.defineProperty(r,"__esModule",{value:!0}),r.UnicodeService=void 0;let l=a(8460),u=a(225);r.UnicodeService=class{constructor(){this._providers=Object.create(null),this._active="",this._onChange=new l.EventEmitter,this.onChange=this._onChange.event;let n=new u.UnicodeV6;this.register(n),this._active=n.version,this._activeProvider=n}dispose(){this._onChange.dispose()}get versions(){return Object.keys(this._providers)}get activeVersion(){return this._active}set activeVersion(n){if(!this._providers[n])throw new Error(`unknown Unicode version "${n}"`);this._active=n,this._activeProvider=this._providers[n],this._onChange.fire(n)}register(n){this._providers[n.version]=n}wcwidth(n){return this._activeProvider.wcwidth(n)}getStringCellWidth(n){let d=0,f=n.length;for(let p=0;p<f;++p){let _=n.charCodeAt(p);if(55296<=_&&_<=56319){if(++p>=f)return d+this.wcwidth(_);let e=n.charCodeAt(p);56320<=e&&e<=57343?_=1024*(_-55296)+e-56320+65536:d+=this.wcwidth(e)}d+=this.wcwidth(_)}return d}}}},z={};function j(O){var r=z[O];if(r!==void 0)return r.exports;var a=z[O]={exports:{}};return q[O].call(a.exports,a,a.exports,j),a.exports}var J={};return(()=>{var O=J;Object.defineProperty(O,"__esModule",{value:!0}),O.Terminal=void 0;let r=j(9042),a=j(3236),l=j(844),u=j(5741),n=j(8285),d=j(7975),f=j(7090),p=["cols","rows"];class _ extends l.Disposable{constructor(s){super(),this._core=this.register(new a.Terminal(s)),this._addonManager=this.register(new u.AddonManager),this._publicOptions=Object.assign({},this._core.options);let t=o=>this._core.options[o],i=(o,c)=>{this._checkReadonlyOptions(o),this._core.options[o]=c};for(let o in this._core.options){let c={get:t.bind(this,o),set:i.bind(this,o)};Object.defineProperty(this._publicOptions,o,c)}}_checkReadonlyOptions(s){if(p.includes(s))throw new Error(`Option "${s}" can only be set in the constructor`)}_checkProposedApi(){if(!this._core.optionsService.rawOptions.allowProposedApi)throw new Error("You must set the allowProposedApi option to true to use proposed API")}get onBell(){return this._core.onBell}get onBinary(){return this._core.onBinary}get onCursorMove(){return this._core.onCursorMove}get onData(){return this._core.onData}get onKey(){return this._core.onKey}get onLineFeed(){return this._core.onLineFeed}get onRender(){return this._core.onRender}get onResize(){return this._core.onResize}get onScroll(){return this._core.onScroll}get onSelectionChange(){return this._core.onSelectionChange}get onTitleChange(){return this._core.onTitleChange}get onWriteParsed(){return this._core.onWriteParsed}get element(){return this._core.element}get parser(){return this._parser||(this._parser=new d.ParserApi(this._core)),this._parser}get unicode(){return this._checkProposedApi(),new f.UnicodeApi(this._core)}get textarea(){return this._core.textarea}get rows(){return this._core.rows}get cols(){return this._core.cols}get buffer(){return this._buffer||(this._buffer=this.register(new n.BufferNamespaceApi(this._core))),this._buffer}get markers(){return this._checkProposedApi(),this._core.markers}get modes(){let s=this._core.coreService.decPrivateModes,t="none";switch(this._core.coreMouseService.activeProtocol){case"X10":t="x10";break;case"VT200":t="vt200";break;case"DRAG":t="drag";break;case"ANY":t="any"}return{applicationCursorKeysMode:s.applicationCursorKeys,applicationKeypadMode:s.applicationKeypad,bracketedPasteMode:s.bracketedPasteMode,insertMode:this._core.coreService.modes.insertMode,mouseTrackingMode:t,originMode:s.origin,reverseWraparoundMode:s.reverseWraparound,sendFocusMode:s.sendFocus,wraparoundMode:s.wraparound}}get options(){return this._publicOptions}set options(s){for(let t in s)this._publicOptions[t]=s[t]}blur(){this._core.blur()}focus(){this._core.focus()}resize(s,t){this._verifyIntegers(s,t),this._core.resize(s,t)}open(s){this._core.open(s)}attachCustomKeyEventHandler(s){this._core.attachCustomKeyEventHandler(s)}registerLinkProvider(s){return this._core.registerLinkProvider(s)}registerCharacterJoiner(s){return this._checkProposedApi(),this._core.registerCharacterJoiner(s)}deregisterCharacterJoiner(s){this._checkProposedApi(),this._core.deregisterCharacterJoiner(s)}registerMarker(s=0){return this._verifyIntegers(s),this._core.registerMarker(s)}registerDecoration(s){var t,i,o;return this._checkProposedApi(),this._verifyPositiveIntegers((t=s.x)!==null&&t!==void 0?t:0,(i=s.width)!==null&&i!==void 0?i:0,(o=s.height)!==null&&o!==void 0?o:0),this._core.registerDecoration(s)}hasSelection(){return this._core.hasSelection()}select(s,t,i){this._verifyIntegers(s,t,i),this._core.select(s,t,i)}getSelection(){return this._core.getSelection()}getSelectionPosition(){return this._core.getSelectionPosition()}clearSelection(){this._core.clearSelection()}selectAll(){this._core.selectAll()}selectLines(s,t){this._verifyIntegers(s,t),this._core.selectLines(s,t)}dispose(){super.dispose()}scrollLines(s){this._verifyIntegers(s),this._core.scrollLines(s)}scrollPages(s){this._verifyIntegers(s),this._core.scrollPages(s)}scrollToTop(){this._core.scrollToTop()}scrollToBottom(){this._core.scrollToBottom()}scrollToLine(s){this._verifyIntegers(s),this._core.scrollToLine(s)}clear(){this._core.clear()}write(s,t){this._core.write(s,t)}writeln(s,t){this._core.write(s),this._core.write(`\r
`,t)}paste(s){this._core.paste(s)}refresh(s,t){this._verifyIntegers(s,t),this._core.refresh(s,t)}reset(){this._core.reset()}clearTextureAtlas(){this._core.clearTextureAtlas()}loadAddon(s){this._addonManager.loadAddon(this,s)}static get strings(){return r}_verifyIntegers(...s){for(let t of s)if(t===1/0||isNaN(t)||t%1!=0)throw new Error("This API only accepts integers")}_verifyPositiveIntegers(...s){for(let t of s)if(t&&(t===1/0||isNaN(t)||t%1!=0||t<0))throw new Error("This API only accepts positive integers")}}O.Terminal=_})(),J})()))});var we=me((le,pe)=>{(function(q,z){typeof le=="object"&&typeof pe=="object"?pe.exports=z():typeof define=="function"&&define.amd?define([],z):typeof le=="object"?le.FitAddon=z():q.FitAddon=z()})(self,(()=>(()=>{"use strict";var q={};return(()=>{var z=q;Object.defineProperty(z,"__esModule",{value:!0}),z.FitAddon=void 0,z.FitAddon=class{activate(j){this._terminal=j}dispose(){}fit(){let j=this.proposeDimensions();if(!j||!this._terminal||isNaN(j.cols)||isNaN(j.rows))return;let J=this._terminal._core;this._terminal.rows===j.rows&&this._terminal.cols===j.cols||(J._renderService.clear(),this._terminal.resize(j.cols,j.rows))}proposeDimensions(){if(!this._terminal||!this._terminal.element||!this._terminal.element.parentElement)return;let j=this._terminal._core,J=j._renderService.dimensions;if(J.css.cell.width===0||J.css.cell.height===0)return;let O=this._terminal.options.scrollback===0?0:j.viewport.scrollBarWidth,r=window.getComputedStyle(this._terminal.element.parentElement),a=parseInt(r.getPropertyValue("height")),l=Math.max(0,parseInt(r.getPropertyValue("width"))),u=window.getComputedStyle(this._terminal.element),n=a-(parseInt(u.getPropertyValue("padding-top"))+parseInt(u.getPropertyValue("padding-bottom"))),d=l-(parseInt(u.getPropertyValue("padding-right"))+parseInt(u.getPropertyValue("padding-left")))-O;return{cols:Math.max(2,Math.floor(d/J.css.cell.width)),rows:Math.max(1,Math.floor(n/J.css.cell.height))}}}})(),q})()))});var Oe={};Te(Oe,{FitAddon:()=>ke.FitAddon,Terminal:()=>Ee.Terminal});var Ee=Ce(ye()),ke=Ce(we());return Me(Oe);})();

/**
 * dsh-geek-sidebar client 半（单文件：平台以 /plugins/dsh-geek-sidebar/client.js 直发浏览器，无打包器）。
 * 三个 feature 共用一个模块，apply 内逐个 try/catch 隔离，一个挂不影响其余：
 *   1. filemention — dshFileMention 服务 + conversation.input.left Tracker
 *   2. workbench   — 侧栏/文件预览/底栏（host.call("workbench.x") 由下方 shim 走 POST /__dsh-geek-sidebar__/wb/x）
 *   3. skills      — 技能管理弹窗 + dshSkillsUI 服务（路由 /__dsh-geek-sidebar__/skills/*）
 */
window.__ModuleLoader__.load({
  id: 'dsh-geek-sidebar',
  factory: (require) => {
    var module = { exports: {} }
    var exports = module.exports

    const React = require('react')
    const h = React.createElement
    const { useState, useEffect, useCallback, useRef } = React

    /* ============================ 共享层 ============================ */
    const API = '/__dsh-geek-sidebar__'

    async function api(method, path, body) {
      const res = await fetch(API + path, {
        method,
        headers: body ? { 'content-type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data.error) throw new Error(data.error || ('HTTP ' + res.status))
      return data
    }

    /* workbench 的 host 调用约定：host.call("workbench.x", args) → POST /wb/x */
    const host = { call: (name, args) => api('POST', '/wb/' + String(name).replace(/^workbench\./, ''), args || {}) }

    /* workbench 样式：<link> 直挂 host 路由（每请求读盘，改 style.css 刷新页面即生效）。
     * 注：此挂载在 Fiber 回收体系之外——但静态插件 Fiber 生命周期 = 应用生命周期，
     * 不会泄漏；这是有意为之的体系外单例（以 data- 属性幂等防重）。 */
    function mountStyle(href) {
      if (document.querySelector('link[data-dsh-geek-sidebar-style]')) return
      const el = document.createElement('link')
      el.rel = 'stylesheet'
      el.href = href
      el.setAttribute('data-dsh-geek-sidebar-style', '1')
      document.head.appendChild(el)
    }

    /* 技能弹窗实例句柄：SkillsModal 挂载后填充；workbench 底栏经 skillsUI 直接调用 */
    let skillsModalApi = null
    const skillsUI = {
      open(cwd) { if (skillsModalApi) skillsModalApi.open(cwd) },
      close() { if (skillsModalApi) skillsModalApi.close() },
    }

    /* dshFileMention 的模块内桥：cordis 的 ctx.get 要求提供方 fiber 处于 ACTIVE 态，
     * 同模块内 provide 后立刻 get 会拿到 undefined（fiber 尚在启动态），导致 workbench
     * 的 @ 按钮永不渲染。模块内消费一律走这个惰性代理；ctx.provide 保留给外部插件。 */
    let fileMentionImpl = null
    const fileMentionBridge = {
      mention(sessionId, text) { return fileMentionImpl ? fileMentionImpl.mention(sessionId, text) : false },
    }

    /* ============================ feature 1: filemention ============================
     * dshFileMention：把 "@文件路径" 插入指定会话的输入框草稿。
     * Tracker 挂在 conversation.input.left 槽（不渲染），持续缓存每个会话最新发布
     * 的输入状态（draft / draftRev），mention() 用其构造 span 走平台输入机的受管
     * 写入口 slash/input-insert-text（span 携带 draftRev 做 CAS，防并发写冲突）。
     */
    function applyFilemention(ctx) {
      /* sessionId -> 最新发布的输入状态 */
      const latest = new Map()

      function Tracker(props) {
        const session = props.session
        const sid = session && (session.sessionId || session.id)
        useEffect(() => {
          if (sid && props.input) latest.set(sid, props.input)
        })
        useEffect(() => () => { if (sid) latest.delete(sid) }, [sid])
        return null
      }

      ctx.provide('dshFileMention')
      fileMentionImpl = {
        /* 把 text（如 "@docs/a.md "）追加到 sessionId 会话的草稿末尾。
         * 返回 true = 插入被输入机接受；false = 无会话/无缓存/CAS 失败。 */
        mention(sessionId, text) {
          const st = latest.get(sessionId)
          if (!st) return false
          const actx = ctx.sessions.scope(sessionId)
          if (!actx) return false
          const draft = String(st.draft || '')
          const span = { start: draft.length, end: draft.length, draftRev: st.draftRev }
          return actx.bail(actx, 'slash/input-insert-text', { text: String(text), span }) === true
        },
      }
      ctx.dshFileMention = fileMentionImpl

      ctx.slots.inject('conversation.input.left', () =>
        ctx.slots.register({ name: 'conversation.input.left', id: 'dsh-geek-sidebar-filemention' }, (props) => h(Tracker, props))
      )
    }

    /* ============================ feature 2: workbench ============================ */
const workbenchMod = (function (React, host) {
/* workbench feature 维护源码（可读版）：侧栏（工作区/会话/git worktree）、文件管理器（项目/笔记）、
 * 文件预览（大纲/编辑/聚焦重读/手动刷新）、底栏（技能/助手入口）。
 * 由 parts/build.mjs 与 head.js / skills.js / tail.js 拼接成 lib/client.js；改这里，别改产物。 */
const P = "pw-",
  store = {
    buckets: {},
    bucket(t) {
      const e = t || "_";
      return (
        store.buckets[e] || (store.buckets[e] = { files: [], active: null }),
        store.buckets[e]
      );
    },
    open(t, e) {
      const s = store.bucket(t);
      /* 已打开也要激活 + fire——旧版 || 短路导致"重复点击已打开文件不切换"（评审 P2） */
      if (!s.files.some((o) => o.path === e.path)) s.files = s.files.concat([e]);
      s.active = e.path;
      bus.fire();
    },
    close(t, e) {
      const s = store.bucket(t);
      ((s.files = s.files.filter((o) => o.path !== e)),
        s.active === e &&
          (s.active = s.files.length ? s.files[s.files.length - 1].path : null),
        bus.fire());
    },
    setActive(t, e) {
      ((store.bucket(t).active = e), bus.fire());
    },
    sub(t) {
      return bus.sub(t);
    },
  },
  bus = {
    fns: [],
    fire() {
      for (const t of bus.fns.slice()) t();
    },
    sub(t) {
      return (
        bus.fns.push(t),
        () => {
          const e = bus.fns.indexOf(t);
          e >= 0 && bus.fns.splice(e, 1);
        }
      );
    },
  },
  /* createValueStore：value-store 工厂（字段访问 + set + bus.fire 三件套）。
   * setFn 返回 false 时不触发 fire（用于"值不变不刷新"）。取代手抄的同名模式。 */
  createValueStore = (fields, setFn) => {
    const s = Object.assign({}, fields);
    s.set = (v) => {
      if (setFn(s, v) !== false) bus.fire();
    };
    return s;
  },
  viewStore = createValueStore({ view: "main" }, (s, v) => {
    s.view = v;
  }),
  notesStore = createValueStore({ dirs: [], current: null }, (s, v) => {
    ((s.dirs = (v && v.dirs) || []), (s.current = (v && v.current) || null));
  }),
  filesTabStore = createValueStore({ tab: "project" }, (s, v) => s.tab !== v && (s.tab = v)),
  /* 图片点击放大：当前放大的图片 src，null = 关闭 */
  imgZoomStore = createValueStore({ src: null }, (s, v) => {
    s.src = v || null;
  }),
  /* 下侧边栏（助手面板）开态：open/tab/height。组件在 15-bottom-panel.js，
   * store 必须放最前——渲染若早于后续文件求值会踩跨文件 TDZ（实战踩过）。 */
  bottomPanel = {
    open: false,
    tab: "terminal",
    height: (() => {
      /* 非浏览器环境（smoke eval）无 window，兜底 360 */
      try {
        const w = typeof window !== "undefined" ? window : null;
        const v = w && w.localStorage ? Number(w.localStorage.getItem("pw-bpanel-h")) : 0;
        if (v >= 140 && v <= 900) return v;
        if (w && w.innerHeight) return Math.max(180, Math.round(w.innerHeight * 0.42));
      } catch (e) {}
      return 360;
    })(),
    set(patch) {
      Object.assign(bottomPanel, patch);
      bus.fire();
    },
  },
  /* 底部区域仲裁：第三方经 dshBottomPanels.acquire(id) 独占占位，占位期间我们的面板
   * 让位（open 状态保留，release 后自动归位）——对齐右栏 details 的"它开我们让位、
   * 它关我们归位"。右栏靠 single 槽 priority 天然仲裁；shell.overlay 是多槽无此语义，
   * 故自建排他锁。面板组件在 15-bottom-panel.js，消费方 BottomPanel 渲染与挤压都读它。 */
  bottomArea = {
    owner: null,
    acquire(t) {
      if (!t || (bottomArea.owner && bottomArea.owner !== t)) return false;
      if (bottomArea.owner === t) return true;
      ((bottomArea.owner = t), bus.fire());
      return true;
    },
    release(t) {
      if (!bottomArea.owner) return false;
      if (t !== undefined && bottomArea.owner !== t) return false;
      ((bottomArea.owner = null), bus.fire());
      return true;
    },
    isYielded() {
      return !!bottomArea.owner;
    },
  };
function useNotes() {
  const t = React.useState(0);
  return (
    React.useEffect(() => bus.sub(() => t[1]((e) => e + 1)), []),
    { dirs: notesStore.dirs, current: notesStore.current }
  );
}
const baseName = (t) =>
  String(t || "")
    .replace(/\/+$/, "")
    .split("/")
    .pop() || "";
function useFilesTab() {
  const t = React.useState(filesTabStore.tab);
  return (
    React.useEffect(() => bus.sub(() => t[1](filesTabStore.tab)), []),
    t[0]
  );
}
const pickNotesDir = () => {
    host
      .call("workbench.notesPick", {})
      .then((t) => {
        t &&
          t.ok &&
          (notesStore.set(t),
          viewStore.set("main"),
          filesTabStore.set("notes"));
      })
      .catch(() => {});
  },
  selectNotesDir = (t) => {
    host
      .call("workbench.notesSelect", { dir: t })
      .then((e) => {
        e && e.ok && notesStore.set(e);
      })
      .catch(() => {});
  };
function usePreviewState(t) {
  const s = React.useState(0)[1];
  React.useEffect(() => store.sub(() => s((l) => l + 1)), []);
  const o = store.bucket(t),
    a = o.files.find((l) => l.path === o.active) || null;
  return { files: o.files, active: o.active, activeFile: a };
}
function useView() {
  const t = React.useState(viewStore.view);
  return (React.useEffect(() => bus.sub(() => t[1](viewStore.view)), []), t[0]);
}
function relTime(t) {
  if (!t) return "";
  const e = Date.now() - t,
    s = Math.floor(e / 6e4);
  if (s < 1) return "just now";
  if (s < 60) return s + "m ago";
  const o = Math.floor(s / 60);
  if (o < 24) return o + "h ago";
  const a = Math.floor(o / 24);
  return a < 30 ? a + "d ago" : new Date(t).toLocaleDateString();
}
function shortPath(t) {
  return t ? t.replace(/^\/Users\/[^/]+/, "~") : "";
}
function canonPath(t) {
  return String(t || "")
    .replace(/\/+$/, "")
    .toLowerCase();
}
/* 跨文件共享的工作区态：当前项目根（@提及/终端 cwd/技能弹窗用）与文件管理器展开偏好。
 * 全部在渲染/回调期读写（无求值期依赖），声明放 stores 文件合乎归属（原寄居 05-icons 末尾）。 */
let explorerOpenPref = !0,
  currentRootPath = null;
const isMd = (t) => /\.(md|markdown)$/i.test(t);
function mdInline(t) {
  const e = [],
    s =
      /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`|!\[[^\]]*\]\([^)]*\)|\[[^\]]+\]\([^)]*\))/g;
  let o = 0,
    a,
    l = 0;
  for (; (a = s.exec(t)) !== null;) {
    a.index > o && e.push(t.slice(o, a.index));
    const c = a[0];
    if (c.startsWith("**") || c.startsWith("__"))
      e.push(React.createElement("strong", { key: l++ }, c.slice(2, -2)));
    else if (c.startsWith("~~"))
      e.push(React.createElement("del", { key: l++ }, c.slice(2, -2)));
    else if (c.startsWith("`"))
      e.push(
        React.createElement(
          "code",
          { key: l++, className: "pw-inline-code" },
          c.slice(1, -1),
        ),
      );
    else if (c.startsWith("![")) {
      const u = c.match(/!\[([^\]]*)\]\(([^)]*)\)/);
      e.push(
        React.createElement("img", {
          key: l++,
          src: mediaUrl(u[2]),
          alt: u[1],
          style: { maxWidth: "100%" },
          onClick: (g) => {
            (g.stopPropagation(), imgZoomStore.set(mediaUrl(u[2])));
          },
          onError: (g) => {
            const t = g.currentTarget;
            t.style.display = "none";
            const ph = document.createElement("span");
            ph.className = "pw-img-broken";
            ph.textContent = "图片加载失败：" + (u[1] || u[2]);
            t.parentNode && t.parentNode.insertBefore(ph, t);
          },
        }),
      );
    } else if (c.startsWith("[")) {
      const u = c.match(/\[([^\]]*)\]\(([^)]*)\)/);
      e.push(
        React.createElement(
          "a",
          {
            key: l++,
            href: u[2],
            target: "_blank",
            rel: "noreferrer",
            onClick: (g) => {
              const p = resolveLocalPath(u[2]);
              p && (g.preventDefault(), openLocalPath(p));
            },
          },
          u[1],
        ),
      );
    } else e.push(React.createElement("em", { key: l++ }, c.slice(1, -1)));
    o = a.index + c.length;
  }
  return (o < t.length && e.push(t.slice(o)), e);
}
function renderMarkdown(t, e, bd) {
  mdBaseDir = typeof bd == "string" ? bd : "";
  const s = String(t).replace(
      /\r\n/g,
      `
`,
    ).split(`
`),
    o = [];
  let a = 0,
    l = 0;
  const c = React.createElement;
  for (; a < s.length;) {
    const r = s[a].trim();
    if (r === "") {
      a++;
      continue;
    }
    if (r.startsWith("```")) {
      /* 围栏语言：CODE_LANGS 认识（js/ts/py/sh/json 系）才接 highlightCode 着色——
       * 未知语言（含 mermaid）保持原文，highlightCode 对未知语言会错染 js 关键词。
       * mermaid 不图形渲染（用户决策 2026-08：使用频率低，不值得 +1MB vendor 依赖；
       * 与主对话行为一致——主应用同样按源码块展示），回看点此注释再议 */
      const lang = r.slice(3).trim().toLowerCase(),
        h = [];
      for (a++; a < s.length && !s[a].trim().startsWith("```");)
        (h.push(s[a]), a++);
      const body = h.join(`
`);
      (a++,
        o.push(
          c(
            "pre",
            { key: l++, className: "pw-code" },
            c(
              "code",
              null,
              lang && typeof CODE_LANGS !== "undefined" && CODE_LANGS[lang] ? highlightCode(body, lang) : body,
            ),
          ),
        ));
      continue;
    }
    const m = r.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      const h = { key: l++, className: "pw-h" };
      if (e) {
        const g = e.length;
        (e.push(null),
          (h.ref = (y) => {
            e[g] = y;
          }));
      }
      (o.push(c("h" + m[1].length, h, mdInline(m[2]))), a++);
      continue;
    }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(r)) {
      (o.push(c("hr", { key: l++ })), a++);
      continue;
    }
    if (/^>\s?/.test(r)) {
      const h = [];
      for (; a < s.length && /^>\s?/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^>\s?/, "")), a++);
      o.push(
        c(
          "blockquote",
          { key: l++, className: "pw-quote" },
          mdInline(h.join(" ")),
        ),
      );
      continue;
    }
    if (
      /^\|(.+)\|\s*$/.test(r) &&
      a + 1 < s.length &&
      /^\|[\s:|-]+\|\s*$/.test(s[a + 1].trim())
    ) {
      const h = (x) =>
          x
            .trim()
            .replace(/^\||\|$/g, "")
            .split("|")
            .map((p) => p.trim()),
        g = h(s[a]);
      a += 2;
      const y = [];
      for (; a < s.length && /^\|(.+)\|\s*$/.test(s[a].trim());)
        (y.push(h(s[a])), a++);
      o.push(
        c(
          "table",
          { key: l++, className: "pw-table" },
          c(
            "thead",
            null,
            c(
              "tr",
              null,
              g.map((x, p) => c("th", { key: p }, mdInline(x))),
            ),
          ),
          c(
            "tbody",
            null,
            y.map((x, p) =>
              c(
                "tr",
                { key: p },
                x.map((C, I) => c("td", { key: I }, mdInline(C))),
              ),
            ),
          ),
        ),
      );
      continue;
    }
    if (/^[-*+]\s+/.test(r)) {
      const h = [];
      for (; a < s.length && /^[-*+]\s+/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^[-*+]\s+/, "")), a++);
      o.push(
        c(
          "ul",
          { key: l++, className: "pw-list" },
          h.map((g, y) => c("li", { key: y }, mdInline(g))),
        ),
      );
      continue;
    }
    if (/^\d+[.)]\s+/.test(r)) {
      const h = [];
      for (; a < s.length && /^\d+[.)]\s+/.test(s[a].trim());)
        (h.push(s[a].trim().replace(/^\d+[.)]\s+/, "")), a++);
      o.push(
        c(
          "ol",
          { key: l++, className: "pw-list" },
          h.map((g, y) => c("li", { key: y }, mdInline(g))),
        ),
      );
      continue;
    }
    const k = [r];
    for (a++; a < s.length;) {
      const h = s[a].trim();
      if (
        h === "" ||
        h.startsWith("```") ||
        /^(#{1,6})\s/.test(h) ||
        /^>/.test(h) ||
        /^[-*+]\s/.test(h) ||
        /^\d+[.)]\s/.test(h) ||
        /^\|/.test(h)
      )
        break;
      (k.push(h), a++);
    }
    o.push(c("p", { key: l++, className: "pw-p" }, mdInline(k.join(" "))));
  }
  return o;
}
function TreeNode(t) {
  const e = t.entry,
    s = t.depth,
    o = t.treeState,
    a = React.createElement,
    l = e.type === "directory",
    c = !!o.expanded[e.path],
    u = o.children[e.path],
    r = !!o.loading[e.path],
    m = t.activePath === e.path,
    h2 = React.useState(!1),
    g2 = h2[0],
    C2 = h2[1],
    doDel = () => {
      (C2(!1), t.onDelete && t.onDelete(e));
    },
    h = [
      a(
        "div",
        {
          className: "pw-tree-row" + (m ? " active" : ""),
          style: { paddingLeft: 8 + s * 14 + "px" },
          onClick: () => t.onOpen(e),
        },
        a(
          "span",
          { className: "pw-tree-arrow" },
          l ? (c ? ChevronDown(11) : ChevronRight(11)) : "",
        ),
        a(
          "span",
          { className: "pw-tree-icon" },
          l ? FolderIcon(13) : fileIconEl(e.name, 13),
        ),
        a("span", { className: "pw-tree-name" }, e.name),
        r ? a("span", { className: "pw-tree-loading" }, "…") : null,
        t.onMention
          ? a(
              "button",
              {
                className: "pw-tree-dl",
                title: "@ 提及到输入框",
                onClick: (g) => {
                  (g.stopPropagation(), t.onMention(e));
                },
              },
              AtIcon(12),
            )
          : null,
        a(
          "button",
          {
            className:
              "pw-tree-dl" +
              (t.dlBusy === e.path ? " spin" : "") +
              (t.dlDone === e.path ? " flash" : ""),
            title: l ? "打包下载到 ~/Downloads" : "下载到 ~/Downloads",
            onClick: (g) => {
              (g.stopPropagation(), t.onDownload && t.onDownload(e));
            },
          },
          DownloadIcon(12),
          t.dlDone === e.path ? flashEl(11) : null,
        ),
        t.onDelete
          ? g2
            ? a(
                React.Fragment,
                null,
                a(
                  "button",
                  {
                    className: "pw-tree-dl danger",
                    title: "确认删除（移到废纸篓）",
                    onClick: (g) => {
                      (g.stopPropagation(), doDel());
                    },
                  },
                  "✓",
                ),
                a(
                  "button",
                  {
                    className: "pw-tree-dl",
                    title: "取消",
                    onClick: (g) => {
                      (g.stopPropagation(), C2(!1));
                    },
                  },
                  "×",
                ),
              )
            : a(
                "button",
                {
                  className: "pw-tree-dl",
                  title: "删除（移到废纸篓，Shift 跳过确认）",
                  onClick: (g) => {
                    (g.stopPropagation(), g.shiftKey ? doDel() : C2(!0));
                  },
                },
                TrashIcon(12),
              )
          : null,
      ),
    ];
  if (l && c && u) {
    for (const g of u)
      g.name === ".DS_Store" ||
        h.push(
          a(TreeNode, {
            key: g.path,
            entry: g,
            depth: s + 1,
            treeState: o,
            onOpen: t.onOpen,
            onDownload: t.onDownload,
            dlBusy: t.dlBusy,
            dlDone: t.dlDone,
            onMention: t.onMention,
            activePath: t.activePath,
            onDelete: t.onDelete,
          }),
        );
    u.length === 0 &&
      h.push(
        a(
          "div",
          {
            key: "empty",
            className: "pw-tree-empty",
            style: { paddingLeft: 22 + s * 14 + "px" },
          },
          "empty",
        ),
      );
  }
  return a(React.Fragment, null, h);
}
const OA = Object.assign;
/* 打开文件预览前请右栏当前占用者退场：自家驱动经 panelStore.close() 正常归位；
 * 外来面板（如 GTM 抽屉，打开即注册 details、无外部关闭 API）则点它自带的 × 按钮，
 * 走它自己的清理路径（注销注册 + 关栏 + 复位开态），状态一致。选择器失效时静默退化为不轮换。 */
function yieldToPreview() {
  try {
    panelStore.close();
  } catch (e) {}
  try {
    const b = document.querySelector('.dsh-gtm-drawer .dsh-gtm-head button[title="关闭"]');
    if (b) b.click();
  } catch (e) {}
}
function FileBrowser(t) {
  const e = React.createElement,
    o = (t.tab || "project") === "notes",
    a = t.notesDir || null,
    l = o ? a : t.root,
    c = t.open !== !1,
    u = t.onToggle,
    r = React.useState({ expanded: {}, children: {}, loading: {}, rev: 0 }),
    m = r[0],
    k = r[1],
    h = React.useState(!1),
    g = h[0],
    y = h[1],
    x = React.useState(!1),
    p = x[0],
    C = x[1],
    I = React.useState(null),
    R = I[0],
    T = I[1],
    H = React.useState(null),
    b = H[0],
    L = H[1],
    A = React.useState(!1),
    E = A[0],
    D = A[1],
    w = (i, N) => (
      k((S) => {
        if (!N && S.children[i]) return S;
        const v = OA({}, S.loading);
        return ((v[i] = !0), OA({}, S, { loading: v }));
      }),
      host
        .call("workbench.listDir", { path: i })
        .then((S) => {
          k((v) => {
            const F = OA({}, v.children),
              X = OA({}, v.loading);
            return (
              delete X[i],
              (F[i] = (S && S.entries) || []),
              OA({}, v, { children: F, loading: X })
            );
          });
        })
        .catch(() => {
          k((S) => {
            const v = OA({}, S.loading);
            return (delete v[i], OA({}, S, { loading: v }));
          });
        })
    );
  React.useEffect(() => {
    l && w(l);
  }, [l]);
  const j = (i) => {
      if (i.type === "directory") {
        const N = !m.expanded[i.path];
        (k((S) => {
          const v = OA({}, S.expanded);
          return ((v[i.path] = N), OA({}, S, { expanded: v }));
        }),
          N && !m.children[i.path] && w(i.path));
      } else
        (yieldToPreview(),
          store.open(t.sessionId, { path: i.path, name: i.name }),
          t.layout && t.layout.openDetails());
    },
    z = (i) => {
      R ||
        (L(null),
        T(i.path),
        host
          .call(
            i.type === "directory"
              ? "workbench.downloadDir"
              : "workbench.download",
            { path: i.path },
          )
          .then((N) => {
            (T(null), N && N.ok && L(i.path));
          })
          .catch(() => T(null)));
    },
    K = () => {
      l &&
        host
          .call("workbench.uploadPick", { destDir: l })
          .then((i) => {
            i && i.ok && B();
          })
          .catch(() => {});
    };
  React.useEffect(() => store.sub(() => k((i) => OA({}, i))), []);
  const B = () => {
      if (g) return;
      (C(!1), y(!0));
      const i = Object.keys(m.expanded).filter(
        (v) => m.expanded[v] && l && (v === l || v.indexOf(l + "/") === 0),
      );
      k((v) => ({
        expanded: v.expanded,
        children: {},
        loading: {},
        rev: v.rev + 1,
      }));
      const N = [];
      l && N.push(w(l, !0));
      for (const v of i) v !== l && N.push(w(v, !0));
      const S = () => {
        (y(!1), flashDone(C));
      };
      /* Promise.all([]) 也会正常 resolve，无需对空数组再补一次（旧版 S 会跑两遍，评审 P3） */
      Promise.all(N).then(S, S);
    },
    onDel = (i) => {
      host
        .call("workbench.delete", { path: i.path })
        .then((N) => {
          if (!N || !N.ok) return;
          const dir = i.path.replace(/\/[^/]*$/, "") || "/";
          (k((S) => {
            const v = OA({}, S.children);
            delete v[i.path];
            for (const F of Object.keys(v))
              F.indexOf(i.path + "/") === 0 && delete v[F];
            const X = OA({}, S.expanded);
            return (delete X[i.path], OA({}, S, { children: v, expanded: X }));
          }),
            dir && w(dir, !0));
          const ab = store.bucket(t.sessionId);
          ab.active &&
            (ab.active === i.path || ab.active.indexOf(i.path + "/") === 0) &&
            store.close(t.sessionId, ab.active);
        })
        .catch((N) => {
          console.error("[dsh-geek-sidebar] delete failed", N);
        });
    },
    _ = l ? m.children[l] : null,
    q = o
      ? e(
          "div",
          { className: "pw-nsel" },
          e(
            "button",
            { className: "pw-sel-btn", title: l || "选择笔记目录", onClick: () => D(!E) },
            e(
              "span",
              { className: "pw-mono" + (l ? " pw-tail" : " dim") },
              l ? "\u200e" + shortPath(l) : "选择笔记目录…",
            ),
          ),
          E
            ? e("div", { className: "pw-drop-overlay", onClick: () => D(!1) })
            : null,
          E
            ? e(
                "div",
                { className: "pw-drop" },
                e(
                  "div",
                  { className: "pw-drop-list" },
                  (t.notesDirs || []).map((i) =>
                    e(
                      "button",
                      {
                        key: i,
                        className: "pw-drop-row",
                        onClick: () => {
                          (D(!1), selectNotesDir(i));
                        },
                      },
                      e("span", { className: "pw-check" }, l === i ? "✓" : ""),
                      e("span", { className: "pw-mono" }, baseName(i)),
                    ),
                  ),
                ),
                e(
                  "button",
                  {
                    className: "pw-drop-foot",
                    onClick: () => {
                      (D(!1), t.onPickNotes && t.onPickNotes());
                    },
                  },
                  e("span", { className: "pw-check" }, "＋"),
                  "选择目录…",
                ),
              )
            : null,
        )
      : null;
  return e(
    "div",
    { className: "pw-files" + (c ? "" : " closed") },
    e(
      "div",
      { className: "pw-files-head" },
      e(
        "button",
        {
          className: "pw-files-toggle",
          title: c ? "收起" : "展开",
          onClick: () => u && u(!c),
        },
        e("span", { className: "pw-files-chev" }, ChevronRight(9)),
      ),
      e(
        "div",
        { className: "pw-ftabs" },
        e(
          "button",
          {
            className: "pw-ftab" + (o ? "" : " on"),
            onClick: () => {
              (!c && u && u(!0), t.onTab && t.onTab("project"));
            },
          },
          "项目",
        ),
        e(
          "button",
          {
            className: "pw-ftab" + (o ? " on" : ""),
            onClick: () => {
              (!c && u && u(!0), t.onTab && t.onTab("notes"));
            },
          },
          "笔记",
        ),
      ),
      e(
        "span",
        { className: "pw-files-actions" },
        l
          ? e(
              "button",
              {
                className: "pw-icon-btn",
                title: "上传文件到此目录",
                onClick: K,
              },
              UploadIcon(13),
            )
          : null,
        l && (o || t.workspaces)
          ? e(
              "button",
              {
                className: "pw-icon-btn",
                title: "在系统中打开",
                onClick: () => {
                  o
                    ? host.call("workbench.reveal", { path: l }).catch(() => {})
                    : t.workspaces.openPath(l);
                },
              },
              ExternalIcon(13),
            )
          : null,
        e(
          "button",
          {
            className: "pw-icon-btn" + (g ? " spin" : "") + (p ? " flash" : ""),
            title: "刷新",
            onClick: B,
          },
          RefreshIcon(13),
          p ? flashEl(13) : null,
        ),
      ),
    ),
    c ? q : null,
    c
      ? e(
          "div",
          { className: "pw-files-body" },
          o && !l
            ? e("div", { className: "pw-hint" }, "从上方下拉选择或添加笔记目录")
            : l
              ? _
                ? _.filter((i) => i.name !== ".DS_Store").map((i) =>
                    e(TreeNode, {
                      key: i.path,
                      entry: i,
                      depth: 0,
                      treeState: m,
                      onOpen: j,
                      onDownload: z,
                      dlBusy: R,
                      dlDone: b,
                      onMention: o ? t.onMentionAbs : t.onMention,
                      activePath: store.bucket(t.sessionId).active,
                      onDelete: onDel,
                    }),
                  )
                : e("div", { className: "pw-hint" }, "加载中…")
              : e("div", { className: "pw-hint" }, "无工作区"),
        )
      : null,
  );
}
function FootBar(t) {
  const e = React.createElement,
    s = useView(),
    o = useFilesTab();
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  return t.wide === !1
    ? null
    : e(
        "div",
        { className: "pw-footbar" },
        e(
          "button",
          {
            className: "pw-foot-btn",
            onClick: () => t.onSkills && t.onSkills(),
          },
          e("span", { className: "pw-foot-ic" }, LayersIcon(12)),
          "技能",
        ),
        (() => {
          /* 智能体聚合徽标：运行中（绿）/ 待交互（黄）数量，面板关着也能看见 */
          const ac = acpTabs.counts();
          return e(
            "button",
            {
              className: "pw-foot-btn" + (bottomPanel.open ? " on" : ""),
              title:
                "助手：终端 / Kimi 智能体" +
                (ac.total ? "（运行中 " + ac.run + " · 待交互 " + ac.wait + " · 共 " + ac.total + " 个）" : ""),
              onClick: () => bottomPanel.set({ open: !bottomPanel.open }),
            },
            e("span", { className: "pw-foot-ic" }, BotIcon(12)),
            "助手",
            ac.run > 0 ? e("span", { className: "pw-foot-badge run", title: "运行中 " + ac.run }, String(ac.run)) : null,
            ac.wait > 0 ? e("span", { className: "pw-foot-badge wait", title: "待交互 " + ac.wait }, String(ac.wait)) : null,
          );
        })(),
      );
}

function iconSvg(t, e) {
  return React.createElement(
    "svg",
    {
      width: e || 13,
      height: e || 13,
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round",
      strokeLinejoin: "round",
    },
    t,
  );
}
const elIcon = React.createElement;
function ic(t, e) {
  return iconSvg(
    t.map((s, o) => {
      const a = s[0];
      return a === "p"
        ? elIcon("path", { key: o, d: s[1] })
        : a === "l"
          ? elIcon("line", { key: o, x1: s[1], y1: s[2], x2: s[3], y2: s[4] })
          : a === "pl"
            ? elIcon("polyline", { key: o, points: s[1] })
            : a === "r"
              ? elIcon("rect", {
                  key: o,
                  x: s[1],
                  y: s[2],
                  width: s[3],
                  height: s[4],
                  rx: s[5],
                })
              : elIcon("circle", { key: o, cx: s[1], cy: s[2], r: s[3] });
    }),
    e,
  );
}
function PencilIcon(t) {
  return ic(
    [["p", "M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"]],
    t,
  );
}
function TrashIcon(t) {
  return ic(
    [
      ["pl", "3 6 5 6 21 6"],
      ["p", "M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"],
      ["p", "M10 11v6M14 11v6"],
      ["p", "M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"],
    ],
    t,
  );
}
function ArchiveIcon(t) {
  return ic(
    [
      ["r", 3, 4, 18, 4, 1],
      ["p", "M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8"],
      ["p", "M10 12h4"],
    ],
    t,
  );
}
function FolderIcon(t) {
  return ic(
    [
      [
        "p",
        "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z",
      ],
    ],
    t,
  );
}
function FileIcon(t) {
  return ic(
    [
      ["p", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"],
      ["pl", "14 2 14 8 20 8"],
    ],
    t,
  );
}
function FileTextIcon(t) {
  return ic(
    [
      ["p", "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"],
      ["pl", "14 2 14 8 20 8"],
      ["l", 16, 13, 8, 13],
      ["l", 16, 17, 8, 17],
    ],
    t,
  );
}
function ImageIcon(t) {
  return ic(
    [
      ["r", 3, 3, 18, 18, 2],
      ["c", 8.5, 8.5, 1.5],
      ["pl", "21 15 16 10 5 21"],
    ],
    t,
  );
}
function CodeIcon(t) {
  return ic(
    [
      ["pl", "16 18 22 12 16 6"],
      ["pl", "8 6 2 12 8 18"],
    ],
    t,
  );
}
function BracesIcon(t) {
  return ic(
    [
      [
        "p",
        "M8 3H7a2 2 0 0 0-2 2v4a2 2 0 0 1-2 2 2 2 0 0 1 2 2v4a2 2 0 0 0 2 2h1",
      ],
      [
        "p",
        "M16 3h1a2 2 0 0 1 2 2v4a2 2 0 0 0 2 2 2 2 0 0 0-2 2v4a2 2 0 0 1-2 2h-1",
      ],
    ],
    t,
  );
}
function GlobeIcon(t) {
  return ic(
    [
      ["c", 12, 12, 10],
      ["l", 2, 12, 22, 12],
      [
        "p",
        "M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z",
      ],
    ],
    t,
  );
}
function RefreshIcon(t) {
  return ic(
    [
      ["p", "M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"],
      ["p", "M3 3v5h5"],
    ],
    t,
  );
}
function ExternalIcon(t) {
  return ic(
    [
      ["p", "M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"],
      ["pl", "15 3 21 3 21 9"],
      ["l", 10, 14, 21, 3],
    ],
    t,
  );
}
function DownloadIcon(t) {
  return ic(
    [
      ["p", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
      ["pl", "7 10 12 15 17 10"],
      ["l", 12, 15, 12, 3],
    ],
    t,
  );
}
function UploadIcon(t) {
  return ic(
    [
      ["p", "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"],
      ["pl", "17 8 12 3 7 8"],
      ["l", 12, 3, 12, 15],
    ],
    t,
  );
}
function ListIcon(t) {
  return ic(
    [
      ["l", 8, 6, 21, 6],
      ["l", 8, 12, 21, 12],
      ["l", 8, 18, 21, 18],
      ["l", 3, 6, 3.01, 6],
      ["l", 3, 12, 3.01, 12],
      ["l", 3, 18, 3.01, 18],
    ],
    t,
  );
}
function ChevronRight(t) {
  return ic([["pl", "9 18 15 12 9 6"]], t);
}
function ChevronDown(t) {
  return ic([["pl", "6 9 12 15 18 9"]], t);
}
function CheckIcon(t) {
  return ic([["pl", "20 6 9 17 4 12"]], t);
}
function AtIcon(t) {
  return ic(
    [
      ["c", 12, 12, 4],
      ["p", "M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-4 8"],
    ],
    t,
  );
}
function GitBranchIcon(t) {
  return ic(
    [
      ["l", 6, 3, 6, 15],
      ["c", 18, 6, 3],
      ["c", 6, 18, 3],
      ["p", "M18 9a9 9 0 0 1-9 9"],
    ],
    t,
  );
}
function CopyIcon(t) {
  return ic(
    [
      ["r", 9, 9, 13, 13, 2],
      ["p", "M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"],
    ],
    t,
  );
}
function MinimizeIcon(t) {
  return ic(
    [
      ["pl", "4 14 10 14 10 20"],
      ["pl", "20 10 14 10 14 4"],
      ["l", 10, 14, 3, 21],
      ["l", 21, 3, 14, 10],
    ],
    t,
  );
}
/* 实心停止块（压缩中等中止态用，pi-web 同款）：ic() 是描边体系，这里子节点显式填充 */
function StopIcon(t) {
  return iconSvg([elIcon("rect", { x: 6, y: 6, width: 12, height: 12, rx: 2, fill: "currentColor", stroke: "none" })], t);
}
/* 对勾闪现：置位 1.2s 后自动复位（评审修复：原先只置位不复位，刷新/下载对勾永久残留；
 * 两处调用方 03-tree.js/09-sidebar.js 均传布尔 setter，宿主组件常驻，超时后 setState 安全） */
function flashDone(t) {
  t(!0);
  setTimeout(() => t(!1), 1200);
}
const flashEl = (t) =>
  React.createElement("span", { className: "pw-flash-check" }, CheckIcon(t));
const recentRoots = [];
function rememberRoot(t) {
  if (!t) return;
  const e = recentRoots.indexOf(t);
  (e >= 0 && recentRoots.splice(e, 1),
    recentRoots.unshift(t),
    recentRoots.length > 8 && (recentRoots.length = 8));
}
const sessionProbe = {
  sid: null,
  set(t) {
    sessionProbe.sid !== t && ((sessionProbe.sid = t), bus.fire());
  },
  sub(t) {
    return bus.sub(t);
  },
};
function mentionPath(t, e) {
  const s = currentRootPath;
  return (
    "@" +
    (s && t.indexOf(s + "/") === 0 ? t.slice(s.length + 1) : t) +
    (e ? "/ " : " ")
  );
}
const CODE_KW = {
    js: "const let var function return if else for while class extends import export from default new try catch finally throw async await yield typeof instanceof in of switch case break continue this null undefined true false interface type enum implements readonly public private static",
    py: "def return if elif else for while class import from as with try except finally raise lambda yield async await pass break continue global nonlocal is in not and or True False None self print",
    sh: "if then else elif fi for while do done case esac function return local export echo cd exit source",
    json: "true false null",
  },
  CODE_LANGS = {
    js: "js",
    jsx: "js",
    mjs: "js",
    cjs: "js",
    ts: "js",
    tsx: "js",
    py: "py",
    sh: "sh",
    bash: "sh",
    zsh: "sh",
    json: "json",
  },
  isCodeExt = (t) =>
    Object.prototype.hasOwnProperty.call(
      CODE_LANGS,
      (t.split(".").pop() || "").toLowerCase(),
    ),
  isCsvExt = (t) => /\.csv$/i.test(t),
  isHtmlExt = (t) => /\.(html?|xhtml)$/i.test(t);
function codeTokens(t, e) {
  const s = [],
    o =
      /(\/\/[^\n]*|#[^\n]*|\/\*[\s\S]*?\*\/|'(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|`(?:[^`\\]|\\.)*`|\b\d+(?:\.\d+)?\b)/g;
  let a = 0,
    l,
    c = 0;
  for (; (l = o.exec(t)) !== null;) {
    (l.index > a && s.push(...kwWrap(t.slice(a, l.index), e, c)),
      (c = s.length));
    const u = l[0],
      r =
        u.charAt(0) === "/" || u.charAt(0) === "#"
          ? "c"
          : u.charAt(0) === '"' || u.charAt(0) === "'" || u.charAt(0) === "`"
            ? "s"
            : "n";
    (s.push(
      React.createElement(
        "span",
        { key: "t" + c++, className: "pw-tok-" + r },
        u,
      ),
    ),
      (a = l.index + u.length));
  }
  return (
    a < t.length && s.push(...kwWrap(t.slice(a), e, c)),
    s.length ? s : [t]
  );
}
function kwWrap(t, e, s) {
  if (!e) return [t];
  const o = [];
  let a = 0,
    l;
  const c = new RegExp(e.source, "g");
  for (; (l = c.exec(t)) !== null;)
    (l.index > a && o.push(t.slice(a, l.index)),
      o.push(
        React.createElement(
          "span",
          { key: "k" + s + "-" + l.index, className: "pw-tok-k" },
          l[0],
        ),
      ),
      (a = l.index + l[0].length));
  return (a < t.length && o.push(t.slice(a)), o);
}
function highlightCode(t, e) {
  const s = CODE_LANGS[e] || "js",
    o = CODE_KW[s],
    a = o ? new RegExp("\\b(" + o.split(" ").join("|") + ")\\b", "g") : null;
  return String(t)
    .split(
      `
`,
    )
    .map((l, c) =>
      React.createElement(
        "div",
        { key: c, className: "pw-codeline" },
        React.createElement("span", { className: "pw-lineno" }, String(c + 1)),
        React.createElement("span", null, codeTokens(l, a)),
      ),
    );
}
function parseCsv(t) {
  const e = [];
  let s = [],
    o = "",
    a = !1;
  for (let l = 0; l < t.length; l++) {
    const c = t[l];
    a
      ? c === '"'
        ? t[l + 1] === '"'
          ? ((o += '"'), l++)
          : (a = !1)
        : (o += c)
      : c === '"'
        ? (a = !0)
        : c === ","
          ? (s.push(o), (o = ""))
          : c ===
              `
`
            ? (s.push(o), e.push(s), (s = []), (o = ""))
            : c !== "\r" && (o += c);
  }
  return (
    (o !== "" || s.length) && (s.push(o), e.push(s)),
    e.filter((l) => l.length > 1 || l[0] !== "")
  );
}
function CsvView(t) {
  const e = React.createElement,
    s = parseCsv(t.text || "");
  if (s.length === 0) return e("pre", { className: "pw-src" }, t.text || "");
  const o = s[0],
    a = s.slice(1, 501);
  return e(
    "div",
    { className: "pw-csv-wrap" },
    e(
      "table",
      { className: "pw-csv" },
      e(
        "thead",
        null,
        e(
          "tr",
          null,
          o.map((l, c) => e("th", { key: c }, l)),
        ),
      ),
      e(
        "tbody",
        null,
        a.map((l, c) =>
          e(
            "tr",
            { key: c },
            l.map((u, r) => e("td", { key: r }, u)),
          ),
        ),
      ),
      s.length > 501
        ? e("div", { className: "pw-hint" }, "仅显示前 500 行")
        : null,
    ),
  );
}
function fileIconEl(t, e) {
  const s = (t.split(".").pop() || "").toLowerCase(),
    o = e || 13;
  return s === "md" || s === "markdown" || s === "txt"
    ? FileTextIcon(o)
    : ["png", "jpg", "jpeg", "gif", "webp", "svg"].indexOf(s) >= 0
      ? ImageIcon(o)
      : [
            "js",
            "ts",
            "jsx",
            "tsx",
            "mjs",
            "cjs",
            "py",
            "sh",
            "go",
            "rs",
            "java",
            "rb",
          ].indexOf(s) >= 0
        ? CodeIcon(o)
        : s === "json" || s === "yml" || s === "yaml" || s === "toml"
          ? BracesIcon(o)
          : ["html", "css", "vue"].indexOf(s) >= 0
            ? GlobeIcon(o)
            : FileIcon(o);
}
function SessionRow(t) {
  const e = React.createElement,
    s = t.sm,
    o = t.id,
    a = t.sessionsSvc,
    l = t.workspacesSvc,
    c = React.useState(!1),
    u = c[0],
    r = c[1],
    m = React.useState(""),
    k = m[0],
    h = m[1],
    g = React.useState(!1),
    y = g[0],
    x = g[1],
    p = React.useState(!1),
    C = p[0],
    I = p[1],
    R = s.displayTitle || s.title || o,
    T = t.branch,
    H = (w) => {
      (w.stopPropagation(), h(R), r(!0));
    },
    b = () => {
      r(!1);
      const w = k.trim();
      if (!w || w === R) return;
      const j = a && a.binding ? a.binding(o) : void 0;
      j && typeof j.rename == "function" && j.rename(w).catch(() => {});
    },
    L = () => {
      (x(!1), I(!0), l && l.archiveSession(o).catch(() => I(!1)));
    },
    A = (w) => {
      if ((w.stopPropagation(), w.shiftKey)) {
        L();
        return;
      }
      x(!0);
    },
    E = (w) => {
      (w.stopPropagation(), l && l.archiveSession(o).catch(() => {}));
    },
    D = () => {
      u || y || (a && a.open(o));
    };
  return y
    ? e(
        "div",
        { className: "pw-sess-row confirming" },
        e(
          "span",
          { className: "pw-confirm-text" },
          "删除「" + (R.length > 22 ? R.slice(0, 22) + "…" : R) + "」？",
        ),
        e(
          "button",
          {
            className: "pw-btn-danger",
            onClick: (w) => {
              (w.stopPropagation(), L());
            },
          },
          TrashIcon(11),
          "删除",
        ),
        e(
          "button",
          {
            className: "pw-btn-plain",
            onClick: (w) => {
              (w.stopPropagation(), x(!1));
            },
          },
          "取消",
        ),
      )
    : u
      ? e(
          "div",
          { className: "pw-sess-row" },
          e("input", {
            className: "pw-sess-rename",
            value: k,
            autoFocus: !0,
            onFocus: (w) => w.currentTarget.select(),
            onChange: (w) => h(w.target.value),
            onBlur: b,
            onKeyDown: (w) => {
              (w.key === "Enter" && b(), w.key === "Escape" && r(!1));
            },
            onClick: (w) => w.stopPropagation(),
          }),
        )
      : e(
          "div",
          {
            className: "pw-sess-row" + (t.active ? " active" : ""),
            style: C ? { opacity: 0.5 } : null,
            onClick: D,
          },
          e(
            "div",
            { className: "pw-sess-main" },
            e("div", { className: "pw-sess-title", title: R }, R),
            e(
              "div",
              { className: "pw-sess-meta" },
              s.running ? e("span", { className: "pw-dot-run" }, "●") : null,
              s.pendingInteraction
                ? e("span", { className: "pw-dot-warn" }, "●")
                : null,
              T
                ? e(
                    "span",
                    { className: "pw-sess-wt", title: s.cwd },
                    GitBranchIcon(10),
                    " " + T,
                  )
                : null,
              e("span", null, relTime(s.updatedAt)),
            ),
          ),
          e(
            "div",
            { className: "pw-row-acts" },
            e(
              "button",
              { className: "pw-act-btn", title: "重命名", onClick: H },
              PencilIcon(13),
            ),
            e(
              "button",
              {
                className: "pw-act-btn danger",
                title: "删除（Shift 跳过确认）",
                onClick: A,
              },
              TrashIcon(13),
            ),
            e(
              "button",
              { className: "pw-act-btn", title: "归档会话", onClick: E },
              ArchiveIcon(13),
            ),
          ),
        );
}
function Sidebar(t) {
  const e = React.createElement,
    s = t.layout,
    o = t.sessionsSvc,
    a = t.workspacesSvc,
    l = useView(),
    c = useNotes(),
    u = useFilesTab(),
    r = t.useSessions((n) => n.ids),
    m = t.useSessions((n) => n.byId),
    k = t.useSessions((n) => n.current),
    h = t.useWorkspaces((n) => n.items),
    g = t.useWorkspaces((n) => n.recentWorkspaceId),
    y = t.useWorkspaces((n) => n.archivedSessionIds),
    x = React.useState(null),
    p = x[0],
    C = x[1],
    I = React.useState({}),
    R = I[0],
    T = I[1],
    H = React.useState(null),
    b = H[0],
    L = H[1],
    A = React.useState(!1),
    E = A[0],
    D = A[1],
    w = React.useState(""),
    j = w[0],
    z = w[1],
    K = React.useState(!1),
    B = K[0],
    _ = K[1],
    q = React.useState(""),
    i = q[0],
    N = q[1],
    S = React.useState(!1),
    v = S[0],
    F = S[1],
    X = React.useState(""),
    se = X[0],
    ae = X[1],
    ue = React.useState(!1),
    U = ue[0],
    Q = ue[1],
    fe = React.useState(""),
    de = fe[0],
    V = fe[1],
    he = React.useState(null),
    Ae = he[0],
    le = he[1],
    me = React.useState(explorerOpenPref),
    pe = me[0],
    Be = me[1],
    ke = (n) => {
      ((explorerOpenPref = n), Be(n));
    };
  React.useEffect(() => {
    u === "notes" && ke(!0);
  }, [u]);
  const be = React.useState(!1),
    Pe = be[0],
    we = be[1],
    ge = React.useState(!1),
    Ne = ge[0],
    ve = ge[1],
    ye = {};
  for (const n of y || []) ye[n] = !0;
  const Y = (r || []).filter((n) => {
      const f = m[n];
      return f && !ye[n] && f.origin !== "subagent";
    }),
    Z = k ? m[k] : void 0,
    Se = React.useRef(null);
  (React.useEffect(() => {
    Z && Z.cwd && C(Z.cwd);
    const n = Se.current;
    if (((Se.current = k || null), n && n !== k && a)) {
      const f = m[n];
      f && f.blank === !0 && a.archiveSession(n).catch(() => {});
    }
  }, [k, Z && Z.cwd]),
    React.useEffect(() => {
      if (p) return;
      const n = (h || []).find((f) => f.workspaceId === g) || (h || [])[0];
      n && n.path && C(n.path);
    }, [h, g]));
  const oe = (n) => {
      const f = [],
        d = {},
        W = (O) => {
          O && !d[O] && (n || !R[O]) && ((d[O] = !0), f.push(O));
        };
      for (const O of Y) W(m[O].cwd);
      W(p);
      for (const O of h || []) W(O.path);
      return f.length === 0
        ? Promise.resolve()
        : host
            .call("workbench.projectMap", { cwds: f, force: !!n })
            .then((O) => {
              !O || !O.map || T((ze) => OA({}, ze, O.map));
            })
            .catch(() => {});
    },
    Fe = Y.map((n) => m[n].cwd || "").join("|");
  React.useEffect(() => {
    oe(!1);
  }, [Fe, p]);
  const ee = (n) => {
      if (!n) return "";
      const f = R[n];
      return (f && f.root) || n;
    },
    M = ee(p);
  (React.useEffect(() => {
    currentRootPath = p;
  }, [p]),
    React.useEffect(() => {
      sessionProbe.set(k || null);
    }, [k]));
  const ce = (n, f) =>
    n
      ? host
          .call("workbench.worktrees", { path: n, force: !!f })
          .then((d) => {
            d && d.forPath === n && L(d);
          })
          .catch(() => {})
      : (L(null), Promise.resolve());
  React.useEffect(() => {
    ce(p, !1);
  }, [p]);
  const Te = () => {
      if (Pe) return;
      (ve(!1), we(!0));
      const n = () => {
        (we(!1), flashDone(ve));
      };
      Promise.all([oe(!0), ce(p, !0)]).then(n, n);
    },
    $ = {};
  for (const n of Y) {
    const f = m[n],
      d = ee(f.cwd);
    if (!d) continue;
    $[d] || ($[d] = { root: d, latest: 0, running: 0, pending: 0 });
    const W = $[d];
    ((f.updatedAt || 0) > W.latest && (W.latest = f.updatedAt || 0),
      f.running && W.running++,
      f.pendingInteraction && W.pending++);
  }
  (rememberRoot(M),
    M && !$[M] && ($[M] = { root: M, latest: 0, running: 0, pending: 0 }));
  for (const n of recentRoots)
    $[n] || ($[n] = { root: n, latest: 0, running: 0, pending: 0 });
  const Le = Object.keys($)
      .map((n) => $[n])
      .sort((n, f) => f.latest - n.latest),
    te = [];
  {
    const n = {};
    for (const f of Le) {
      const d = canonPath(f.root);
      n[d] || ((n[d] = !0), te.push(f));
    }
  }
  const He = te.some(
      (n) =>
        canonPath(n.root) !== canonPath(M) && (n.running > 0 || n.pending > 0),
    ),
    oWs = te.filter((n) => canonPath(n.root) !== canonPath(M)),
    oRun = oWs.reduce((n, f) => n + f.running, 0),
    oPend = oWs.reduce((n, f) => n + f.pending, 0),
    aRun = te.reduce((n, f) => n + f.running, 0),
    aPend = te.reduce((n, f) => n + f.pending, 0),
    cRun = aRun - oRun,
    cPend = aPend - oPend,
    Re = Y.filter((n) => !m[n].blank && (!M || ee(m[n].cwd) === M)).sort(
      (n, f) => (m[f].updatedAt || 0) - (m[n].updatedAt || 0),
    ),
    J = !!(b && b.isGit && b.isTopLevel && b.forPath === p),
    G =
      (J &&
        (b.worktrees.find((n) => n.path === b.currentWorktreePath) ||
          b.worktrees.find((n) => n.isMain))) ||
      null,
    _e = (n) => {
      if (!a || !n) return;
      const f = (h || []).find((d) => d.path === n);
      if (f) {
        a.startSession(f.workspaceId);
        return;
      }
      a.create({ path: n })
        .then((d) => a.startSession(d.workspaceId))
        .catch(() => {});
    },
    Ve = () => {
      a &&
        a
          .pickDirectory()
          .then((n) => {
            if (!n) return;
            (C(n), D(!1));
            const f = (h || []).find((d) => d.path === n);
            if (f) {
              a.connectWorkspace(f.workspaceId);
              return;
            }
            return a
              .create({ path: n })
              .then((d) => a.connectWorkspace(d.workspaceId));
          })
          .catch(() => {});
    },
    xe = (n) => {
      const f = Y.filter(n).sort(
        (d, W) => (m[W].updatedAt || 0) - (m[d].updatedAt || 0),
      )[0];
      f && o && o.open(f);
    },
    $e = (n) => {
      (C(n), D(!1), z(""), xe((f) => ee(m[f].cwd) === n));
    },
    Ge = (n) => {
      (C(n), _(!1), V(""), N(""), F(!1), xe((f) => m[f].cwd === n));
    },
    Ce = () => {
      !se.trim() ||
        U ||
        !b ||
        (Q(!0),
        V(""),
        host
          .call("workbench.worktreeAdd", {
            cwd: b.projectRoot,
            branch: se.trim(),
          })
          .then((n) => {
            if ((Q(!1), !n || !n.ok)) {
              V((n && n.error) || "创建失败");
              return;
            }
            (F(!1), ae(""), C(n.path), ce(n.path, !0), oe(!0));
          })
          .catch((n) => {
            (Q(!1), V(String(n)));
          }));
    },
    De = (n, f) => {
      U ||
        !b ||
        (Q(!0),
        host
          .call("workbench.worktreeRemove", { cwd: p, path: n, force: f })
          .then((d) => {
            if ((Q(!1), !d || !d.ok)) {
              f ? V((d && d.error) || "删除失败") : le(n);
              return;
            }
            (le(null),
              b.currentWorktreePath === n && C(b.projectRoot),
              ce(b.currentWorktreePath === n ? b.projectRoot : p, !0),
              oe(!0));
          })
          .catch(() => {
            Q(!1);
          }));
    };
  if (t.wide === !1) return null;
  const Ee = te.length > 8,
    je =
      Ee && j.trim()
        ? te.filter(
            (n) => n.root.toLowerCase().indexOf(j.trim().toLowerCase()) >= 0,
          )
        : te,
    ne = J ? b.worktrees : [],
    Me = ne.length >= 8,
    Ie =
      Me && i.trim()
        ? ne.filter(
            (n) =>
              (n.branch || shortPath(n.path))
                .toLowerCase()
                .indexOf(i.trim().toLowerCase()) >= 0,
          )
        : ne;
  let We = null;
  E &&
    (We = e(
      "div",
      { className: "pw-drop" },
      Ee
        ? e(
            "div",
            { className: "pw-drop-filter" },
            e("input", {
              className: "pw-input",
              value: j,
              placeholder: "过滤项目…",
              onChange: (n) => z(n.target.value),
            }),
          )
        : null,
      e(
        "div",
        { className: "pw-drop-list" },
        je.map((n) =>
          e(
            "button",
            {
              key: n.root,
              className:
                "pw-drop-row" +
                (canonPath(n.root) === canonPath(M) ? " cur" : ""),
              title: n.root,
              onClick: () => $e(n.root),
            },
            e(
              "span",
              { className: "pw-check" },
              canonPath(n.root) === canonPath(M) ? "✓" : "",
            ),
            e("span", { className: "pw-mono" }, shortPath(n.root)),
            n.running > 0
              ? e("span", { className: "pw-act run" }, "● " + n.running)
              : null,
            n.pending > 0
              ? e("span", { className: "pw-act warn" }, "● " + n.pending)
              : null,
          ),
        ),
        je.length === 0
          ? e("div", { className: "pw-hint" }, "没有匹配的项目")
          : null,
      ),
      e(
        "button",
        { className: "pw-drop-foot", onClick: Ve },
        e("span", { className: "pw-check" }, "＋"),
        "自定义路径",
      ),
    ));
  let Oe = null;
  if (J && B) {
    const n = Ie.map((d) => {
        const W = d.path === b.currentWorktreePath;
        return Ae === d.path
          ? e(
              "div",
              { key: d.path, className: "pw-confirm-row" },
              e("span", { className: "pw-confirm-text" }, "强制删除该检出？"),
              e(
                "button",
                {
                  className: "pw-btn-danger",
                  disabled: U,
                  onClick: () => De(d.path, !0),
                },
                "强制",
              ),
              e(
                "button",
                { className: "pw-btn-plain", onClick: () => le(null) },
                "取消",
              ),
            )
          : e(
              "div",
              { key: d.path, className: "pw-wt-row" },
              e(
                "button",
                {
                  className: "pw-drop-row" + (W ? " cur" : ""),
                  title: d.path,
                  onClick: () => Ge(d.path),
                },
                e("span", { className: "pw-check" }, W ? "✓" : ""),
                e(
                  "span",
                  { className: "pw-mono" },
                  d.branch || shortPath(d.path),
                ),
                d.isMain
                  ? e("span", { className: "pw-main-badge" }, "主分支")
                  : null,
              ),
              d.isMain
                ? null
                : e(
                    "button",
                    {
                      className: "pw-wt-del",
                      title: "删除 worktree：" + d.path,
                      disabled: U,
                      onClick: () => De(d.path, !1),
                    },
                    TrashIcon(12),
                  ),
            );
      }),
      f = v
        ? e(
            "div",
            { className: "pw-wt-new" },
            e("input", {
              className: "pw-input",
              value: se,
              placeholder: "分支名",
              onChange: (d) => {
                (ae(d.target.value), V(""));
              },
              onKeyDown: (d) => {
                (d.key === "Enter" && (d.preventDefault(), Ce()),
                  d.key === "Escape" && (F(!1), ae(""), V("")));
              },
            }),
            e(
              "div",
              { className: "pw-wt-new-actions" },
              e(
                "button",
                {
                  className: "pw-btn-primary",
                  disabled: U || !se.trim(),
                  onClick: Ce,
                },
                U ? "创建中…" : "创建",
              ),
              e(
                "button",
                {
                  className: "pw-btn-plain",
                  onClick: () => {
                    (F(!1), ae(""), V(""));
                  },
                },
                "取消",
              ),
            ),
          )
        : e(
            "button",
            {
              className: "pw-drop-foot",
              title: "从分支创建新的 worktree 检出",
              onClick: () => {
                (F(!0), V(""));
              },
            },
            e("span", { className: "pw-check" }, "＋"),
            "新建 worktree",
          );
    Oe = e(
      "div",
      { className: "pw-drop" },
      Me
        ? e(
            "div",
            { className: "pw-drop-filter" },
            e("input", {
              className: "pw-input",
              value: i,
              placeholder: "过滤 worktree…",
              onChange: (d) => N(d.target.value),
            }),
          )
        : null,
      e(
        "div",
        { className: "pw-drop-list sm" },
        n,
        Ie.length === 0
          ? e("div", { className: "pw-hint" }, "没有匹配的 worktree")
          : null,
      ),
      de ? e("div", { className: "pw-wt-err" }, de) : null,
      f,
    );
  }
  let ie = null;
  !J && b && b.forPath === p && b.isGit && !b.isTopLevel
    ? (ie = e(
        "div",
        {
          className: "pw-wt-guide",
          title: "打开仓库根目录以管理 worktree。",
          onClick: () => C(b.projectRoot),
        },
        e("span", { className: "pw-wt-guide-icon" }, GitBranchIcon(11)),
        "打开仓库根目录",
      ))
    : !J &&
      b &&
      b.forPath === p &&
      !b.isGit &&
      (ie = e(
        "div",
        {
          className: "pw-wt-guide dim",
          title: "只能在 Git 仓库根目录使用 worktree。",
        },
        e("span", { className: "pw-wt-guide-icon" }, GitBranchIcon(11)),
        "仅 Git 仓库根目录",
      ));
  let re = null;
  return (
    (re = e(
      React.Fragment,
      null,
      e(
        "div",
        { className: "pw-sessions" + (pe ? "" : " solo") },
        Re.length === 0
          ? e("div", { className: "pw-hint" }, "未找到会话")
          : Re.map((n) => {
              const f = m[n];
              return e(SessionRow, {
                key: n,
                id: n,
                sm: f,
                active: n === k,
                sessionsSvc: o,
                workspacesSvc: a,
                branch:
                  (ee(f.cwd) !== f.cwd && R[f.cwd] && R[f.cwd].branch) || null,
              });
            }),
      ),
      e(FileBrowser, {
        root: p,
        notesDir: c.current,
        notesDirs: c.dirs,
        tab: u,
        onTab: (n) => filesTabStore.set(n),
        onPickNotes: pickNotesDir,
        layout: s,
        workspaces: a,
        open: pe,
        onToggle: ke,
        sessionId: k,
        onMention:
          t.mentionBridge && k
            ? (n) =>
                t.mentionBridge.mention(
                  k,
                  mentionPath(n.path, n.type === "directory"),
                )
            : void 0,
        onMentionAbs:
          t.mentionBridge && k
            ? (n) =>
                t.mentionBridge.mention(
                  k,
                  "@" + n.path + (n.type === "directory" ? "/ " : " "),
                )
            : void 0,
      }),
    )),
    e(
      "div",
      { className: "pw-sidebar" },
      e(
        "div",
        { className: "pw-head" },
        e("span", { className: "pw-logo" }, "DSH"),
        e(
          "button",
          {
            className: "pw-new-btn",
            disabled: !p,
            title: p ? "在 " + shortPath(p) + " 新建会话" : "先选择项目",
            onClick: () => _e(p),
          },
          "＋ 新建",
        ),
        e(
          "button",
          {
            className:
              "pw-icon-btn" + (Pe ? " spin" : "") + (Ne ? " flash" : ""),
            title: "刷新",
            onClick: Te,
          },
          RefreshIcon(14),
          Ne ? flashEl(14) : null,
        ),
        e(
          "button",
          {
            className: "pw-icon-btn",
            title: "折叠侧栏",
            onClick: () => s && s.toggleSidebar(),
          },
          "«",
        ),
      ),
      e(
        "div",
        { className: "pw-sel" },
        e(
          "button",
          {
            className: "pw-sel-btn",
            title: M || "",
            onClick: () => {
              (D(!E), _(!1));
            },
          },
          e(
            "span",
            { className: "pw-mono" + (M ? " pw-tail" : " dim") },
            /* LRM 前缀：RTL 截断下保住 ~/ 等前导中性字符的显示顺序 */
            M ? "\u200e" + shortPath(M) : "选择项目…",
          ),
          aRun + aPend > 0
            ? e(
                "span",
                {
                  className: "pw-act-badge",
                  title:
                    "进行中 " +
                    aRun +
                    " · 待交互 " +
                    aPend +
                    "（其中当前工作区：进行中 " +
                    cRun +
                    " · 待交互 " +
                    cPend +
                    "）",
                },
                aRun > 0
                  ? e("span", { className: "pw-act run" }, "● " + aRun)
                  : null,
                aPend > 0
                  ? e("span", { className: "pw-act warn" }, "● " + aPend)
                  : null,
              )
            : null,
        ),
        E
          ? e("div", { className: "pw-drop-overlay", onClick: () => D(!1) })
          : null,
        We,
      ),
      J
        ? e(
            "div",
            { className: "pw-sel sm" },
            e(
              "button",
              {
                className: "pw-sel-btn sm",
                title: G ? "切换 worktree：" + G.path : "切换 worktree",
                onClick: () => {
                  (_(!B), D(!1));
                },
              },
              e(
                "span",
                { className: "pw-wt-icon" + (G && !G.isMain ? " on" : "") },
                GitBranchIcon(11),
              ),
              e(
                "span",
                { className: "pw-mono" },
                G ? G.branch || shortPath(G.path) : "…",
              ),
              G && G.isMain
                ? e("span", { className: "pw-main-badge" }, "主分支")
                : null,
              ne.length > 1
                ? e("span", { className: "pw-main-badge" }, String(ne.length))
                : null,
              e("span", { className: "pw-chev" }, "▾"),
            ),
            B
              ? e("div", { className: "pw-drop-overlay", onClick: () => _(!1) })
              : null,
            Oe,
          )
        : null,
      ie,
      re,
    )
  );
}
/* ==================== details 面板驱动管理器 ====================
 * details 槽的仲裁层：文件预览是默认驱动，其余面板（助手、第三方）经
 * dshDetailsPanels 服务注册为驱动，open/close 排他（替换式弹出：激活即
 * 整体替换右栏内容，关闭即回预览）。驱动不再裸抢 details 槽的 priority；
 * 外来裸注册插件仍按槽语义（最小者渲染）轮值。 */
const panelStore = {
  panels: [],
  activeId: null,
  register(def) {
    if (!def || !def.id || typeof def.render !== "function") return () => {};
    panelStore.panels = panelStore.panels.filter((p) => p.id !== def.id).concat([def]);
    bus.fire();
    return () => {
      panelStore.panels = panelStore.panels.filter((p) => p.id !== def.id);
      if (panelStore.activeId === def.id) panelStore.activeId = null;
      bus.fire();
    };
  },
  open(id) {
    if (!panelStore.panels.some((p) => p.id === id)) return false;
    panelStore.activeId = id;
    bus.fire();
    return true;
  },
  close(id) {
    if (!panelStore.activeId) return false;
    if (id !== undefined && panelStore.activeId !== id) return false;
    panelStore.activeId = null;
    bus.fire();
    return true;
  },
  isOpen(id) {
    return panelStore.activeId === id;
  },
};
function usePanels() {
  const t = React.useState(0);
  React.useEffect(() => bus.sub(() => t[1]((x) => x + 1)), []);
  return { panels: panelStore.panels, activeId: panelStore.activeId };
}
/* 单个驱动渲染失败不拖垮整个 details 列 */
class PanelErrorBoundary extends React.Component {
  constructor(p) {
    super(p);
    this.state = { err: null };
  }
  static getDerivedStateFromError(err) {
    return { err };
  }
  componentDidCatch(err) {
    console.error("[dsh-geek-sidebar] 面板渲染失败", err);
  }
  render() {
    return this.state.err
      ? React.createElement("div", { className: "pw-hint", style: { padding: "20px" } }, "面板渲染失败：" + String((this.state.err && this.state.err.message) || this.state.err))
      : this.props.children;
  }
}
/* PanelHost：替换式弹出（无 tab）。有激活驱动 → 整体替换右栏内容；
 * 驱动 close()（面板自带关闭或入口再点）→ 回到默认预览。 */
function PanelHost(t) {
  const e = React.createElement;
  const { panels, activeId } = usePanels();
  const active = panels.find((p) => p.id === activeId) || null;
  return active ? e(PanelErrorBoundary, { key: active.id }, active.render(t)) : e(Details, t);
}

/* 图片点击放大：全屏遮罩 + 大图，点任意处 / Esc 关闭 */
function ImgZoomView() {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const src = imgZoomStore.src;
  React.useEffect(() => {
    if (!src) return undefined;
    const onKey = (ev) => {
      if (ev.key === "Escape") imgZoomStore.set(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [src]);
  if (!src) return null;
  return e(
    "div",
    { className: "pw-zoom-mask", onClick: () => imgZoomStore.set(null) },
    e("img", { className: "pw-zoom-img", src, alt: "" }),
  );
}

/* 异步回调落地前的活守卫（评审修复）：响应回来时用户可能已切文件/切会话，
 * 比对发起时的 sid+path，不一致就丢弃——否则旧文件的响应写进新文件的视图态 */
function detailsAlive(sid, path) {
  return sessionProbe.sid === sid && store.bucket(sid).active === path;
}

function Details(t) {
  const e = React.createElement,
    s = t.layout,
    a = React.useState(0)[1];
  React.useEffect(() => sessionProbe.sub(() => a((i) => i + 1)), []);
  const sidRef = React.useRef(sessionProbe.sid);
  React.useEffect(() => {
    sidRef.current !== sessionProbe.sid &&
      ((sidRef.current = sessionProbe.sid), a((i) => i + 1));
  });
  const l = usePreviewState(sessionProbe.sid),
    c = l.activeFile,
    u = React.useState(null),
    r = u[0],
    m = u[1],
    k = React.useState("auto"),
    h = k[0],
    g = k[1],
    y = React.useState(""),
    x = y[0],
    p = y[1],
    C = React.useState(!1),
    I = C[0],
    R = C[1],
    T = React.useState(!1),
    H = T[0],
    b = T[1],
    L = React.useState(!1),
    A = L[0],
    E = L[1],
    D = React.useRef([]),
    ed2 = React.useState(!1),
    ed = ed2[0],
    setEd = ed2[1],
    dr2 = React.useState(""),
    draft = dr2[0],
    setDraft = dr2[1],
    sv2 = React.useState(!1),
    saving = sv2[0],
    setSaving = sv2[1],
    edRef = React.useRef(!1);
  /* ed 经 ref 同步给焦点刷新回调：该 effect deps 仅 path，进编辑不会重注册，
   * 旧版回调闭包捕获注册时的 ed（恒 false），编辑中焦点回归仍会触发刷新（评审 P3 #2） */
  React.useEffect(() => {
    edRef.current = ed;
  });
  React.useEffect(() => {
    if ((m(null), p(""), R(!1), b(!1), E(!1), setEd(!1), (D.current = []), !c))
      return;
    let i = !1;
    return (
      host
        .call("workbench.readFile", { path: c.path })
        .then((N) => {
          i || m(N || { error: "empty response" });
        })
        .catch((N) => {
          i || m({ error: String(N) });
        }),
      () => {
        i = !0;
      }
    );
  }, [c && c.path]);
  React.useEffect(() => {
    if (!c) return;
    const rf = () => {
      if (edRef.current || document.visibilityState !== "visible") return;
      const sid0 = sessionProbe.sid, path0 = c.path;
      host
        .call("workbench.readFile", { path: c.path })
        .then((i2) => {
          if (!detailsAlive(sid0, path0)) return;
          i2 &&
            m((S) =>
              S && S.kind === "text" && i2.kind === "text" && S.text === i2.text
                ? S
                : i2,
            );
        })
        .catch(() => {});
    };
    (window.addEventListener("focus", rf),
      document.addEventListener("visibilitychange", rf));
    return () => {
      (window.removeEventListener("focus", rf),
        document.removeEventListener("visibilitychange", rf));
    };
  }, [c && c.path]);
  const w = () => {
      !c ||
        I ||
        (p(""),
        b(!1),
        R(!0),
        (() => {
          const sid0 = sessionProbe.sid, path0 = c.path;
          host
            .call("workbench.download", { path: c.path })
            .then((i) => {
              (R(!1), detailsAlive(sid0, path0) && (i && i.ok ? b(!0) : p("✗ " + ((i && i.error) || "失败"))));
            })
            .catch((i) => {
              (R(!1), detailsAlive(sid0, path0) && p("✗ " + String(i)));
            });
        })());
    },
    j = h === "auto" ? (c && isMd(c.name) ? "preview" : "source") : h,
    z = c ? c.path.split("/").filter(Boolean) : [],
    K = z.length > 3 ? ["…"].concat(z.slice(-3)) : z,
    B = [];
  if (r && r.kind === "text" && j === "preview") {
    const i = String(r.text || "").split(`
`);
    let N = !1;
    for (const S of i) {
      const v = S.trim();
      if (v.startsWith("```")) {
        N = !N;
        continue;
      }
      if (N) continue;
      const F = v.match(/^(#{1,6})\s+(.*)$/);
      F && B.push({ level: F[1].length, text: F[2], index: B.length });
    }
  }
  const _ = (i) => {
      const N = D.current[i];
      (N &&
        typeof N.scrollIntoView == "function" &&
        N.scrollIntoView({ behavior: "smooth", block: "start" }),
        E(!1));
    },
    q = () => (
      (D.current = []),
      c
        ? r
          ? r.error
            ? e(
                "div",
                { className: "pw-hint", style: { padding: "20px" } },
                "无法预览：" + r.error,
              )
            : r.kind === "image"
              ? e(
                  "div",
                  { className: "pw-img-wrap" },
                  e("img", {
                    src: r.url,
                    alt: c.name,
                    onClick: (g) => {
                      (g.stopPropagation(), imgZoomStore.set(r.url));
                    },
                  }),
                )
              : r.kind === "pdf"
                ? e("iframe", {
                    className: "pw-frame",
                    src: r.url,
                    title: c.name,
                  })
                : r.kind === "html"
                  ? e("iframe", {
                      className: "pw-frame",
                      srcDoc: r.html || "",
                      sandbox: "",
                      title: c.name,
                    })
                  : r.kind === "text" && isHtmlExt(c.name)
                    ? e("iframe", {
                        className: "pw-frame",
                        srcDoc: r.text || "",
                        sandbox: "",
                        title: c.name,
                      })
                    : j === "preview"
                      ? e(
                          "div",
                          { className: "pw-md" },
                          renderMarkdown(
                            r.text || "",
                            D.current,
                            c && c.path ? c.path.replace(/\/[^/]*$/, "") : "",
                          ),
                        )
                      : isCsvExt(c.name)
                        ? e(CsvView, { text: r.text || "" })
                        : isCodeExt(c.name)
                          ? e(
                              "div",
                              { className: "pw-codeview" },
                              highlightCode(
                                r.text || "",
                                c.name.split(".").pop().toLowerCase(),
                              ),
                            )
                          : e("pre", { className: "pw-src" }, r.text || "")
          : e(
              "div",
              { className: "pw-hint", style: { padding: "20px" } },
              "加载中…",
            )
        : e(
            "div",
            { className: "pw-empty" },
            e("div", { className: "pw-empty-logo" }, FileTextIcon(40)),
            e("div", null, "在左侧「项目」或「笔记」中点击文件进行预览"),
            e(
              "div",
              { className: "pw-hint" },
              "支持多标签 · Markdown / 图片 / 文本",
            ),
          )
    );
  return e(
    "div",
    { className: "pw-details" },
    e(
      "div",
      { className: "pw-tabs" },
      l.files.length === 0
        ? e("div", { className: "pw-tab dim" }, "文档预览")
        : l.files.map((i) =>
            e(
              "div",
              {
                key: i.path,
                className: "pw-tab" + (i.path === l.active ? " on" : ""),
                title: i.path,
                onClick: () => store.setActive(sessionProbe.sid, i.path),
              },
              e("span", { className: "pw-tab-icon" }, fileIconEl(i.name, 13)),
              e("span", { className: "pw-tab-name" }, i.name),
              e(
                "button",
                {
                  className: "pw-tab-x",
                  title: "关闭",
                  onClick: (N) => {
                    (N.stopPropagation(),
                      store.close(sessionProbe.sid, i.path));
                  },
                },
                "×",
              ),
            ),
          ),
      e("span", { className: "pw-tabs-flex" }),
      e(
        "button",
        {
          className: "pw-col-btn",
          title: "收起右栏",
          onClick: () => s && s.closeDetails(),
        },
        "»",
      ),
    ),
    c
      ? e(
          "div",
          { className: "pw-toolbar" },
          e("span", { className: "pw-crumbs" }, K.join(" / ")),
          e(
            "span",
            { className: "pw-toolbar-right" },
            B.length > 0
              ? e(
                  "button",
                  {
                    className: "pw-tg-sq" + (A ? " on" : ""),
                    title: "大纲",
                    onClick: () => E(!A),
                  },
                  ListIcon(13),
                )
              : null,
            e(
              "button",
              {
                className: "pw-tg" + (j === "source" ? " on" : ""),
                onClick: () => g("source"),
              },
              "Source",
            ),
            e(
              "button",
              {
                className: "pw-tg" + (j === "preview" ? " on" : ""),
                onClick: () => g("preview"),
              },
              "Preview",
            ),
            t.mentionBridge
              ? e(
                  "button",
                  {
                    className: "pw-icon-btn",
                    title: "@ 提及到输入框",
                    onClick: () => {
                      c &&
                        sessionProbe.sid &&
                        t.mentionBridge.mention(
                          sessionProbe.sid,
                          mentionPath(c.path),
                        );
                    },
                  },
                  AtIcon(13),
                )
              : null,
            e(
              "button",
              {
                className: "pw-icon-btn",
                title: "重新加载文件内容",
                onClick: () => {
                  if (!c) return;
                  const sid0 = sessionProbe.sid, path0 = c.path;
                  host
                    .call("workbench.readFile", { path: c.path })
                    .then((i2) => {
                      detailsAlive(sid0, path0) && i2 && m(i2);
                    })
                    .catch((i2) => {
                      detailsAlive(sid0, path0) && m({ error: String(i2) });
                    });
                },
              },
              RefreshIcon(13),
            ),
            r && r.kind === "text" && !ed
              ? e(
                  "button",
                  {
                    className: "pw-icon-btn",
                    title: "编辑文件内容",
                    onClick: () => {
                      (setDraft(r.text || ""), setEd(!0));
                    },
                  },
                  PencilIcon(13),
                )
              : null,
            e(
              "button",
              {
                className:
                  "pw-icon-btn" + (I ? " spin" : "") + (H ? " flash" : ""),
                title: "下载到 ~/Downloads",
                onClick: w,
              },
              DownloadIcon(13),
              H ? flashEl(13) : null,
            ),
            x ? e("span", { className: "pw-dl-msg" }, x) : null,
          ),
        )
      : null,
    A && B.length > 0
      ? e(
          "div",
          { className: "pw-outline" },
          B.map((i) =>
            e(
              "button",
              {
                key: i.index,
                className: "pw-outline-row",
                style: { paddingLeft: 10 + (i.level - 1) * 12 + "px" },
                onClick: () => _(i.index),
              },
              i.text,
            ),
          ),
        )
      : null,
    ed
      ? e(
          "div",
          { className: "pw-edit-wrap" },
          e("textarea", {
            className: "pw-edit-area",
            value: draft,
            disabled: saving,
            spellCheck: !1,
            onChange: (i2) => setDraft(i2.target.value),
          }),
          e(
            "div",
            { className: "pw-edit-bar" },
            e(
              "span",
              { className: "pw-edit-hint" },
              draft !== ((r && r.text) || "") ? "有未保存的修改" : "",
            ),
            e(
              "button",
              {
                className: "pw-btn-plain",
                disabled: saving,
                onClick: () => setEd(!1),
              },
              "取消",
            ),
            e(
              "button",
              {
                className: "pw-btn-primary",
                disabled: saving || draft === ((r && r.text) || ""),
                onClick: () => {
                  if (saving) return;
                  const sid0 = sessionProbe.sid, path0 = c.path;
                  (setSaving(!0),
                    host
                      .call("workbench.writeFile", {
                        path: c.path,
                        text: draft,
                      })
                      .then((i2) => {
                        (setSaving(!1),
                          detailsAlive(sid0, path0) &&
                            (i2 && i2.ok
                              ? (m(OA({}, r, { text: draft })), setEd(!1))
                              : p("✗ " + ((i2 && i2.error) || "保存失败"))));
                      })
                      .catch((i2) => {
                        (setSaving(!1), detailsAlive(sid0, path0) && p("✗ " + String(i2)));
                      }));
                },
              },
              saving ? "保存中…" : "确定保存",
            ),
          ),
        )
      : e(
          "div",
          {
            className: "pw-doc",
            onClick: () => {
              A && E(!1);
            },
          },
          q(),
        ),
      e(ImgZoomView, null),
  );
}
var mdBaseDir = "";
function isExternalHref(s) {
  return /^(https?:|mailto:|#|data:)/i.test(String(s || ""));
}
function resolveLocalPath(s) {
  s = String(s || "").trim();
  if (!s || isExternalHref(s)) return null;
  s = s.replace(/^\.\//, "");
  if (s.slice(0, 2) === "~/") return s;
  if (s.charAt(0) !== "/") {
    if (!mdBaseDir) return null;
    s = mdBaseDir + "/" + s;
  }
  return s;
}
function mediaUrl(s) {
  const p = resolveLocalPath(s);
  return p ? API + "/wb/raw?path=" + encodeURIComponent(p) : s;
}
function openLocalPath(p) {
  try {
    store.open(sessionProbe.sid, { path: p, name: p.split("/").pop() || p });
  } catch (e) {}
}

function PreviewDrawer(t) {
  const e = React.createElement;
  const narrow0 = () => window.matchMedia("(max-width:1219px)").matches;
  const [narrow, setNarrow] = React.useState(narrow0);
  React.useEffect(() => {
    const mq = window.matchMedia("(max-width:1219px)");
    const f = () => setNarrow(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const st = usePreviewState(sessionProbe.sid);
  const [hiddenFor, setHiddenFor] = React.useState(null);
  /* 宽屏下官方 details 栏是否可用：镜像 ui-layout AppFrame 的 detailsSession 门
   * ——有当前会话且 blank===false 才给列宽，否则钳 0（新建空白会话/无会话时
   * openDetails 只恢复宽度偏好，拗不过该钳制，预览被压进 0 宽列不可见）。
   * 平台私有面脆弱点登记：规则跟随 packages/client/ui-layout/src/client/
   * AppFrame.tsx 的 detailsSession，平台升级先核它。useSessions 缺失（框架
   * 全局份额未给到 shell.overlay）时退化为旧行为：仅窄屏出场。
   * 门不可用 → 本 drawer 顶替出场；可用 → 让位回右栏，两者互斥无双重预览。 */
  const detailsAvailable = t.useSessions
    ? t.useSessions((s) => {
        const cur = s.current;
        return cur !== undefined && s.byId[cur] !== undefined && s.byId[cur].blank === false;
      })
    : true;
  if (!narrow && detailsAvailable) return null;
  if (!st.activeFile) return null;
  if (hiddenFor === st.activeFile.path) return null;
  return e(
    React.Fragment,
    null,
    e("div", {
      className: "pw-drawer-mask",
      onClick: () => setHiddenFor(st.activeFile.path),
    }),
    e(
      "div",
      { className: "pw-drawer-wrap" },
      e(Details, {
        sessionId: sessionProbe.sid,
        layout: t.layout,
        workspacesSvc: t.workspacesSvc,
        mentionBridge: t.mentionBridge,
      }),
    ),
  );
}

function LayersIcon(t) {
  return ic(
    [
      ["p", "M12 2L2 7l10 5 10-5-10-5z"],
      ["p", "M2 17l10 5 10-5"],
      ["p", "M2 12l10 5 10-5"],
    ],
    t,
  );
}

function BotIcon(t) {
  return ic(
    [
      ["p", "M12 8V4H8"],
      [
        "p",
        "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2z",
      ],
      ["p", "M2 14h2"],
      ["p", "M20 14h2"],
      ["p", "M9 13v2"],
      ["p", "M15 13v2"],
    ],
    t,
  );
}

/* ==================== ACP 智能体 tabs（Kimi Code）：连接存储层 + 视图 ====================
 * 架构：WS 连接与全部会话状态放在纯 JS 的 AcpClient（不挂 React 生命周期）——
 * 面板关闭/切 tab 组件卸载，连接和 agent 进程照样活着，tab 状态点与侧栏"助手"
 * 徽标因此是实时值。只有 tab 上的 × 会断 WS（host 30s 宽限后回收进程）。
 * 状态机：connecting → idle ⇄ running ⇄ waiting（权限卡）→ idle；dead（退出/失败）可重连。
 * bus.fire 做 50ms 节流：流式 chunk 高频到达，避免每个 token 都全量重渲染。 */

/* content → 纯文本（模块级：acpApplyUpdate 与 AcpClient.applyUpdate 的压缩吸收共用）。
 * 工具调用的 content 是双层包装 {type:'content', content:{type:'text',text}}（实测），须先剥内层 */
const acpTextOf = (c) => {
  if (!c) return "";
  if (typeof c === "string") return c;
  if (Array.isArray(c)) return c.map(acpTextOf).join("");
  const inner = c.content && typeof c.content === "object" ? acpTextOf(c.content) : "";
  return inner || String(c.text || "");
};

/* update 事件 → 流式列表项（append/merge 规则集中在这一处；副作用类 update 走 applyUpdate） */
function acpApplyUpdate(items, update) {
  const kind = update && update.sessionUpdate;
  const content = update && update.content;
  const textOf = acpTextOf;
  /* 工具关键参数提取（实测形状）：locations[0].path 最可靠（completed 时才有）；
   * 其次 in_progress 阶段 content 文本是 input JSON 的完整前缀快照（覆盖语义，非 delta）；
   * 再其次 diff 类条目把 path 放在条目级。 */
  const argOf = (u) => {
    const loc = u && u.locations && u.locations[0] && u.locations[0].path;
    if (loc) return String(loc);
    const cl = u && u.content;
    if (Array.isArray(cl)) {
      for (const it of cl) if (it && typeof it.path === "string" && it.path) return it.path;
    }
    const t = textOf(cl);
    if (!t) return "";
    try {
      const j = JSON.parse(t);
      return String(j.path || j.command || j.file_path || j.filePath || j.query || j.pattern || j.url || j.cmd || "");
    } catch (e) {
      return "";
    }
  };
  const next = items.slice();
  const appendText = (k, t) => {
    if (next.length && next[next.length - 1].kind === k) {
      next[next.length - 1] = Object.assign({}, next[next.length - 1], { text: next[next.length - 1].text + t });
    } else {
      next.push({ key: next.length, kind: k, text: t });
    }
  };
  if (kind === "user_message_chunk") appendText("user", textOf(content));
  else if (kind === "agent_message_chunk") appendText("agent", textOf(content));
  else if (kind === "agent_thought_chunk") appendText("thought", textOf(content));
  else if (kind === "tool_call") {
    next.push({
      key: next.length,
      kind: "tool",
      id: update.toolCallId,
      title: update.title || "工具调用",
      status: update.status || "pending",
      arg: argOf(update),
      output: "",
    });
  } else if (kind === "tool_call_update") {
    const i = next.findIndex((x) => x.kind === "tool" && x.id === update.toolCallId);
    if (i >= 0) {
      const cur = next[i];
      const done = update.status === "completed" || update.status === "failed";
      next[i] = Object.assign({}, cur, {
        status: update.status || cur.status,
        title: update.title || cur.title,
        arg: argOf(update) || cur.arg,
        /* 完成帧的 content/rawOutput 才是工具输出；进行中的 content 只是 input 快照，不入 output */
        output: done ? (typeof update.rawOutput === "string" && update.rawOutput ? update.rawOutput : textOf(update.content)) || cur.output : cur.output,
      });
    }
  } else if (kind === "plan") {
    const entries = (update.entries || []).map((en) => (en.status === "completed" ? "☑ " : en.status === "in_progress" ? "▶ " : "☐ ") + (en.content || ""));
    next.push({ key: next.length, kind: "plan", text: entries.join("\n") });
  }
  return next;
}

/* 压缩通知剥离（kimi 0.37 实测三种形态）：
 * - 回放/auto-compaction：通知 chunk 并入上一条回复的 agent 条目尾部，无法按条目剔除；
 * - 完整形态 "Context compaction started … Tokens after: N"，或裸 "Compaction completed/cancelled."（轮后片段）；
 * - 故渲染层取两类起点中较早者截到通知尾（有 Tokens after 则保其后的文本），前缀真实回复保留。
 *   实时手动压缩走 compacting 缓冲，不进流、无需此兜底 */
const stripCompactNotice = (t) => {
  const s = String(t || "");
  let i = s.indexOf("Context compaction started");
  const j = s.search(/Compaction (?:completed|cancelled)\./);
  if (j >= 0 && (i < 0 || j < i)) i = j;
  if (i < 0) return t;
  const rest = s.slice(i);
  const m = /Tokens after:\s*[\d,]+/.exec(rest);
  return s.slice(0, i) + (m ? rest.slice(m.index + m[0].length) : "");
};

const ACP_STATUS = {
  connecting: { label: "连接中" },
  idle: { label: "空闲" },
  running: { label: "运行中" },
  waiting: { label: "待交互" },
  dead: { label: "已退出" },
};

/* 工具调用状态中文化（kimi 原值 pending/in_progress/completed/failed） */
const TOOL_STATUS = { pending: "等待", in_progress: "运行中", completed: "完成", failed: "失败" };
/* 工具参数显示缩短：路径留末两段，非路径（如命令行）原样交给 CSS 省略 */
const shortArg = (p) => {
  const s = String(p || "");
  if (s.indexOf("/") < 0) return s;
  const seg = s.split("/").filter(Boolean);
  return seg.length > 2 ? "…/" + seg.slice(-2).join("/") : s;
};

class AcpClient {
  constructor(tabId, cwd) {
    this.tabId = tabId;
    this.cwd = cwd;
    this.status = "connecting";
    this.items = [];
    this.sessionId = null;
    this.compacting = false; /* 压缩轮：通知文本属元信息，缓冲到 compactText 不入流 */
    this.compactText = null;
    this._compactTimer = 0; /* 压缩态兜底定时器（120s 自复位） */
    this.modes = null; /* session/new 的 modes（default/plan/auto/yolo） */
    this.configOptions = null; /* configOptions（model/thinking/mode 选择器数据源） */
    this.capabilities = null; /* agentCapabilities（image 等） */
    this.usage = null; /* usage_update：{used,size} */
    this.commands = []; /* available_commands_update：斜杠命令 */
    this.title = ""; /* session_info_update */
    this.perm = null;
    this.fatal = null;
    this.sessions = null; /* session/list 结果（不过滤，渲染时按 cwd 过滤） */
    this.historyBusy = false;
    this.queue = []; /* 后续消息队列 {text,images}：运行中入队，回 idle 自动补发 */
    this.steer = null; /* 待引导消息：cancel 当前轮后回发 */
    this.intentionalClose = false;
    this._fireT = 0;
    this.connect();
  }
  /* 50ms 节流 fire：流式更新合并成约 20fps 的重渲染 */
  fire() {
    if (this._fireT) return;
    this._fireT = setTimeout(() => {
      this._fireT = 0;
      bus.fire();
    }, 50);
  }
  connect() {
    this.intentionalClose = false;
    this.status = "connecting";
    this.fatal = null;
    const u = new URL("/__dsh-geek-sidebar__/wb/acp-ws", location.origin);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    u.search = new URLSearchParams({ agent: "kimi", session: this.tabId, cwd: this.cwd }).toString();
    const ws = new WebSocket(u.toString());
    this.ws = ws;
    ws.onmessage = (ev) => {
      let msg;
      try {
        msg = JSON.parse(ev.data);
      } catch {
        return;
      }
      if (msg.type === "hello") {
        const sameSession = !!(this.sessionId && msg.sessionId === this.sessionId);
        this.sessionId = msg.sessionId;
        this.modes = msg.modes || null;
        this.configOptions = msg.configOptions || null;
        this.capabilities = msg.capabilities || null;
        if (this.status === "connecting") this.status = "idle";
        /* 重连成功：复位退避计数 */
        this._rcAttempt = 0;
        this.reconnecting = 0;
        if (this._rcTimer) {
          clearTimeout(this._rcTimer);
          this._rcTimer = 0;
        }
        /* 刷新恢复/断线回捞（resumeRecent）：拉会话列表，sessions 帧里回捞该目录最近一条有标题会话。
         * 同进程重挂（sessionId 未变）除外——replay 会补齐，不许 load 走当前会话 */
        if (this.resumeRecent) {
          this.resumeRecent = false;
          if (!sameSession) {
            this.resumePick = true;
            this.ws.send(JSON.stringify({ type: "list_sessions" }));
          }
        }
        this._flushQueue(); /* dead 期排队的消息：连回即补发 */
      } else if (msg.type === "replay") {
        for (const u2 of msg.events || []) this.applyUpdate(u2);
      } else if (msg.type === "update") {
        this.applyUpdate(msg.update);
      } else if (msg.type === "turn_end") {
        if (this.status === "running" || this.status === "waiting") this.status = "idle";
        /* 注意：不在此清压缩态——实测 kimi 的 /compact 轮次 ~50ms 即 turn_end（仅应答），
         * 压缩本体在后台跑，完成/取消文本轮后才到（大上下文可达 ~10s）。收场由
         * applyUpdate 见到 completed/cancelled 文本触发，120s 定时兜底 */
        this._flushQueue();
      } else if (msg.type === "permission") {
        this.perm = { requestId: msg.requestId, title: msg.title, options: msg.options || [] };
        this.status = "waiting";
      } else if (msg.type === "sessions") {
        /* 空白对话（title 空 = 从未提问）直接删除、不进历史。两道边界（均实测）：
         * 1) kimi 的 session/delete 只能删本进程 cwd 的会话，跨 cwd 必回 Internal error → 只扫同 cwd，
         *    异 cwd 空白保留在列表数据里（渲染层本来也按 cwd 过滤），等那个目录的 tab 开历史时自清理；
         * 2) 豁免所有存活 tab 的当前会话——它可能正空白等输入，删了下条 prompt 会失效。
         * 清扫删除带 silent：家务操作，失败（理论上不该再有）也不许污染对话流。 */
        const liveIds = Object.keys(acpTabs.clients)
          .map((k) => acpTabs.clients[k] && acpTabs.clients[k].sessionId)
          .filter(Boolean);
        const keep = [];
        for (const s of msg.sessions || []) {
          const blank = s && s.sessionId && !(s.title && String(s.title).trim());
          if (blank && s.cwd === this.cwd && liveIds.indexOf(s.sessionId) < 0) {
            this.ws.send(JSON.stringify({ type: "delete_session", sessionId: s.sessionId, silent: true }));
          } else keep.push(s);
        }
        this.sessions = keep;
        this.historyBusy = false;
        /* 刷新恢复的回捞：最近一条有标题、非当前、未被其他恢复 tab 认领的同 cwd 会话 */
        if (this.resumePick) {
          this.resumePick = false;
          const cand = keep
            .filter((s) => s && s.sessionId && s.cwd === this.cwd && s.title && String(s.title).trim() && s.sessionId !== this.sessionId && acpResumedIds.indexOf(s.sessionId) < 0)
            .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")))[0];
          if (cand) {
            acpResumedIds.push(cand.sessionId);
            this.loadSession(cand.sessionId, true); /* keepQueue：断线期排队的消息在 loaded 后补发 */
          }
        }
      } else if (msg.type === "loaded") {
        /* 换会话：清空流，kimi 随后以 update 帧回放历史 */
        this.items = [];
        this.sessionId = msg.sessionId;
        this.perm = null;
        this.usage = null;
        this._clearCompacting();
        if (this.status !== "dead") this.status = "idle";
        this._flushQueue(); /* 回捞完成后补发断线期排队消息（用户主动换会话时队列已清空，空转） */
      } else if (msg.type === "config") {
        if (msg.sessionId) this.sessionId = msg.sessionId;
        if (msg.modes) this.modes = msg.modes;
        if (msg.configOptions) this.configOptions = msg.configOptions;
      } else if (msg.type === "session_deleted") {
        if (this.sessions) this.sessions = this.sessions.filter((s) => s && s.sessionId !== msg.sessionId);
      } else if (msg.type === "note") {
        this.items = this.items.concat({ key: this.items.length, kind: "note", text: msg.message });
      } else if (msg.type === "error") {
        this.items = this.items.concat({ key: this.items.length, kind: "error", text: msg.message });
        if (this.status === "running" || this.status === "waiting") this.status = "idle";
        this._clearCompacting();
        this._flushQueue();
      } else if (msg.type === "exit") {
        this.status = "dead";
        this._clearCompacting();
        this.items = this.items.concat({ key: this.items.length, kind: "error", text: "进程已退出（code " + msg.code + "）" });
      }
      this.fire();
    };
    ws.onclose = (ev) => {
      if (ev.code === 1011 && ev.reason) this.fatal = ev.reason;
      this._clearCompacting();
      if (!this.intentionalClose) {
        this.status = "dead";
        this._scheduleReconnect(); /* 异常断线：指数退避自动重连（dsh 重启/网络抖动无感恢复） */
      }
      this.fire();
    };
    ws.onerror = () => {};
    this.fire();
  }
  /* session/update：副作用类本地吸收，流式类交给 acpApplyUpdate */
  applyUpdate(u) {
    const kind = u && u.sessionUpdate;
    if (kind === "usage_update") this.usage = { used: u.used || 0, size: u.size || 0 };
    else if (kind === "available_commands_update") this.commands = u.availableCommands || [];
    else if (kind === "session_info_update") this.title = u.title || "";
    else if (kind === "current_mode_update" && u.currentModeId) {
      if (this.modes) this.modes = Object.assign({}, this.modes, { currentModeId: u.currentModeId });
      else this.modes = { currentModeId: u.currentModeId, availableModes: [] };
    } else if (kind === "config_option_update" && Array.isArray(u.configOptions)) {
      this.configOptions = u.configOptions;
    } else if (this.compacting && (kind === "agent_message_chunk" || kind === "agent_thought_chunk")) {
      /* 压缩通知吸收（kimi 0.37 实测：started 应答在轮内，completed/cancelled 在轮后到达，
       * 均属元信息不是对话内容，用户决策不展示）：入缓冲不入流，
       * 见到完成/取消文本立即收场——此后若有真实回复 chunk（压缩期间又发了新消息）正常入流 */
      this.compactText = (this.compactText || "") + acpTextOf(u.content);
      if (/Compaction (?:completed|cancelled)\./.test(this.compactText)) this._clearCompacting();
    } else if (kind === "user_message_chunk" && acpTextOf(u.content).trim() === "/compact") {
      /* kimi 侧 /compact 回声（实时或回放）同样吞掉——压缩命令本身也不进对话 */
    } else {
      this.items = acpApplyUpdate(this.items, u);
    }
  }
  open() {
    return this.ws && this.ws.readyState === 1;
  }
  /* 压缩态跨轮持有：/compact 轮次仅应答（实测 ~50ms 即 turn_end），压缩本体后台运行，
   * 完成/取消文本轮后才到。收场三途：见到 Compaction completed/cancelled 文本、
   * error/loaded/断线清场、120s 定时兜底（kimi 异常静默时不至于卡红钮） */
  _markCompacting() {
    this.compacting = true;
    this.compactText = "";
    if (this._compactTimer) clearTimeout(this._compactTimer);
    this._compactTimer = setTimeout(() => {
      this._compactTimer = 0;
      this._clearCompacting();
      this.fire();
    }, 120000);
  }
  _clearCompacting() {
    this.compacting = false;
    this.compactText = null;
    if (this._compactTimer) {
      clearTimeout(this._compactTimer);
      this._compactTimer = 0;
    }
  }
  sendPrompt(text, images) {
    if (!this.open() || this.status === "running" || this.status === "waiting" || this.status === "dead") return;
    const imgs = (images || []).filter((im) => im && im.data).map((im) => ({ data: im.data, mimeType: im.mimeType }));
    if (!String(text || "").trim() && !imgs.length) return;
    this.ws.send(JSON.stringify({ type: "prompt", text: text || "", images: imgs.length ? imgs : undefined }));
    /* /compact：标记压缩态（通知不回流），本地用户回声也不插——命令本身不污染对话 */
    if (String(text || "").trim() === "/compact") {
      this._markCompacting();
    } else {
      this.items = this.items.concat({
        key: this.items.length,
        kind: "user",
        text: text || "",
        images: (images || []).map((im) => ({ url: im.url })),
      });
    }
    this.status = "running";
    this.perm = null;
    this.fire();
  }
  cancel() {
    if (this.open()) this.ws.send(JSON.stringify({ type: "cancel" }));
  }
  /* 后续消息排队 / 立即引导（参考 Cursor 交互，用户决策 2026-08）。纯客户端编排，
   * 不赌 ACP 中途 prompt 行为：排队=入队后等 turn_end/error 回 idle 自动补发；
   * 引导=cancel 当前轮，轮次结束回发引导文本（等效"打断并转向"）。 */
  enqueue(text, images) {
    this.queue = this.queue.concat({ text: String(text || ""), images: images || [] });
    this.fire();
  }
  popQueue() {
    const m = this.queue[this.queue.length - 1];
    this.queue = this.queue.slice(0, -1);
    this.fire();
    return m || null;
  }
  steerNow(text, images) {
    if (this.status === "running" || this.status === "waiting") {
      this.steer = { text: String(text || ""), images: images || [] };
      this.cancel();
    } else this.sendPrompt(text, images);
  }
  _flushQueue() {
    if (this.status !== "idle" || !this.open()) return;
    let m = this.steer;
    this.steer = null;
    if (!m && this.queue.length) m = this.queue[0];
    if (!m) return;
    if (this.queue[0] === m) this.queue = this.queue.slice(1);
    this.sendPrompt(m.text, m.images);
  }
  answerPermission(requestId, optionId) {
    if (this.open()) this.ws.send(JSON.stringify({ type: "permission", requestId, optionId }));
    this.perm = null;
    if (this.status === "waiting") this.status = "running";
    this.fire();
  }
  setMode(modeId) {
    if (this.open() && modeId) this.ws.send(JSON.stringify({ type: "set_mode", modeId }));
  }
  setConfig(configId, value) {
    if (this.open() && configId) this.ws.send(JSON.stringify({ type: "set_config", configId, value }));
  }
  listSessions() {
    if (!this.open()) return;
    this.historyBusy = true;
    this.ws.send(JSON.stringify({ type: "list_sessions" }));
    this.fire();
  }
  loadSession(sessionId, keepQueue) {
    if (!this.open() || !sessionId || sessionId === this.sessionId || this.status === "running") return;
    if (!keepQueue) {
      this.queue = []; /* 用户主动换会话：队列属于旧会话上下文，即清空 */
      this.steer = null;
    }
    this.ws.send(JSON.stringify({ type: "load_session", sessionId }));
    this.status = "connecting";
    this.perm = null;
    this.fire();
  }
  /* 会话操作三件套：运行/等待中禁止（new/fork 会换 sessionId，中途换会出乱） */
  busy() {
    return this.status === "running" || this.status === "waiting" || this.status === "connecting" || this.status === "dead";
  }
  newSession() {
    if (!this.open() || this.busy()) return;
    this.queue = []; /* 同上：新会话不继承旧队列 */
    this.steer = null;
    this.ws.send(JSON.stringify({ type: "new_session" }));
  }
  forkSession() {
    if (!this.open() || this.busy()) return;
    this.ws.send(JSON.stringify({ type: "fork_session" }));
  }
  deleteSession(sessionId) {
    if (!this.open() || !sessionId || sessionId === this.sessionId) return;
    this.ws.send(JSON.stringify({ type: "delete_session", sessionId }));
  }
  /* 关 tab 前调用：本会话从未提问（无 user 条目——本地发送/回放/重连三路径都会留下 user
   * 条目，判据可靠）则直接删除，不留历史空白。注意 deleteSession() 拒删当前会话，这里须绕开。 */
  discardIfBlank() {
    if (!this.sessionId || !this.open()) return;
    if (this.items.some((it) => it && it.kind === "user")) return;
    this.ws.send(JSON.stringify({ type: "delete_session", sessionId: this.sessionId, silent: true }));
  }
  /* 自动重连（用户决策 2026-08）：1s→2s→4s→8s 封顶，最多 12 次（约 93s 窗口，覆盖 dsh 重启）。
   * 成功由 hello 复位计数；放弃后保留 dead 横幅，手动按钮仍可立即重连。 */
  _scheduleReconnect() {
    if (this._rcTimer) return;
    const attempt = (this._rcAttempt || 0) + 1;
    if (attempt > 12) {
      this.reconnecting = 0;
      return;
    }
    this._rcAttempt = attempt;
    this.reconnecting = attempt;
    this._rcTimer = setTimeout(
      () => {
        this._rcTimer = 0;
        this.reconnect();
      },
      Math.min(1000 * Math.pow(2, attempt - 1), 8000),
    );
  }
  reconnect() {
    if (this._rcTimer) {
      clearTimeout(this._rcTimer);
      this._rcTimer = 0;
    }
    this._rcAttempt = 0;
    this.reconnecting = 0;
    /* 同进程重挂：hello 同 sessionId 自动取消回捞；新进程：回捞最近历史会话 */
    this.resumeRecent = true;
    this.connect();
  }
  close() {
    this.intentionalClose = true;
    if (this._rcTimer) {
      clearTimeout(this._rcTimer);
      this._rcTimer = 0;
    }
    try {
      this.ws && this.ws.close();
    } catch (e) {}
  }
}

/* tab 列表 localStorage 持久化（用户要求 2026-08：刷新不丢已选目录）。
 * 仅存 {id,cwd}；无 window 环境（无头冒烟）安全降级为空操作。 */
const ACP_LS_KEY = "pw-acp-tabs";
const acpLs = {
  read() {
    try {
      if (typeof window === "undefined") return [];
      const v = JSON.parse(window.localStorage.getItem(ACP_LS_KEY) || "[]");
      return Array.isArray(v) ? v : [];
    } catch (e) {
      return [];
    }
  },
  write(tabs) {
    try {
      if (typeof window === "undefined") return;
      window.localStorage.setItem(ACP_LS_KEY, JSON.stringify(tabs.map((t) => ({ id: t.id, cwd: t.cwd }))));
    } catch (e) {}
  },
};
/* 恢复回捞的会话认领表：多个恢复 tab 同目录时不许抢同一条历史会话 */
const acpResumedIds = [];

/* 智能体 tab 注册表：tab 元信息 + 各 tab 的 AcpClient。 */
const acpTabs = {
  seq: 0,
  tabs: [] /* {id,cwd,name} */,
  clients: {} /* id -> AcpClient */,
  add(cwd) {
    const id = "k" + Date.now().toString(36) + ++acpTabs.seq;
    acpTabs.clients[id] = new AcpClient(id, cwd);
    acpTabs.tabs = acpTabs.tabs.concat({ id, cwd, name: baseName(cwd) || cwd });
    acpLs.write(acpTabs.tabs);
    bottomPanel.set({ open: true, tab: id });
    bus.fire();
    return id;
  },
  close(id) {
    const c = acpTabs.clients[id];
    if (c) {
      try {
        c.discardIfBlank();
        c.close();
      } catch (e) {}
    }
    delete acpTabs.clients[id];
    acpTabs.tabs = acpTabs.tabs.filter((t) => t.id !== id);
    acpLs.write(acpTabs.tabs);
    if (bottomPanel.tab === id) bottomPanel.set({ tab: "terminal" });
    bus.fire();
  },
  counts() {
    let run = 0,
      wait = 0;
    for (const t of acpTabs.tabs) {
      const c = acpTabs.clients[t.id];
      if (!c) continue;
      if (c.status === "running") run++;
      else if (c.status === "waiting") wait++;
    }
    return { run, wait, total: acpTabs.tabs.length };
  },
};

/* 刷新恢复：重建上次的 tab（上限 6 个防爆量），AcpClient 重连后回捞该目录最近一条
 * 有标题会话（session/load 回放完整历史，对话不丢）。纯客户端方案，无需 host 改动；
 * 重建时新建的空白会话交给历史面板的空白清扫兜底。 */
function acpRestore() {
  if (typeof window === "undefined") return;
  const saved = acpLs.read();
  for (const t of saved.slice(0, 6)) {
    if (!t || typeof t.cwd !== "string" || !t.cwd) continue;
    const id = typeof t.id === "string" && t.id && !acpTabs.clients[t.id] ? t.id : "k" + Date.now().toString(36) + ++acpTabs.seq;
    const c = new AcpClient(id, t.cwd);
    c.resumeRecent = true;
    acpTabs.clients[id] = c;
    acpTabs.tabs = acpTabs.tabs.concat({ id, cwd: t.cwd, name: baseName(t.cwd) || t.cwd });
  }
  if (acpTabs.tabs.length) bus.fire();
}
acpRestore();

/* 单个智能体 tab 的视图：头部（状态/模式/模型/thinking/历史）+ 用量条 + 流 + 权限卡 + 输入行 */
function AgentTabView({ client }) {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const [draft, setDraft] = React.useState("");
  const [images, setImages] = React.useState([]); /* {url,data,mimeType}，最多 4 张 */
  const [histOpen, setHistOpen] = React.useState(false);
  const [delId, setDelId] = React.useState(null); /* 历史行删除的两击确认态 */
  const [slashIdx, setSlashIdx] = React.useState(0);
  const [slashOff, setSlashOff] = React.useState(false); /* Esc 关闭补全弹窗，继续输入自动复位 */
  const [usageOpen, setUsageOpen] = React.useState(false); /* 上下文用量浮层 */
  const [copiedKey, setCopiedKey] = React.useState(null); /* 消息操作条「已复制」反馈（按 item.key） */
  const scrollRef = React.useRef(null);
  const fileRef = React.useRef(null);
  /* 自动滚动信号 = 条数 + 末条文本长度：流式 chunk 并入末条（appendText 合并）时
   * items.length 不变，只盯条数会长回复流式期间不滚动（评审修复） */
  const lastIt = client.items[client.items.length - 1];
  const scrollSig = client.items.length + ":" + (lastIt && lastIt.text ? lastIt.text.length : 0);
  React.useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [scrollSig]);
  /* usage/历史两浮层的外点与 Esc 收回：pointerdown 早于按钮 click，命中自身
   * 控件（closest 命中）时忽略——开关按钮自身的切换逻辑不受影响；点控制行
   * 其他按钮（新对话/分叉/下拉）同样收回浮层。 */
  React.useEffect(() => {
    if (!usageOpen && !histOpen) return undefined;
    const onDown = (ev) => {
      const t = ev.target;
      if (t && typeof t.closest === "function"
        && (t.closest(".pw-acp-usage") || t.closest(".pw-acp-pop")
          || t.closest(".pw-acp-hist-btn") || t.closest(".pw-acp-hist"))) return;
      setUsageOpen(false);
      setHistOpen(false);
    };
    const onKey = (ev) => {
      if (ev.key === "Escape") { setUsageOpen(false); setHistOpen(false); }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [usageOpen, histOpen]);
  /* configOptions 里的三个 select 数据源（kimi 0.36 实测：model/thinking/mode） */
  const coOf = (id) => (client.configOptions || []).find((o) => o && o.id === id) || null;
  const modeCo = coOf("mode"),
    modelCo = coOf("model"),
    thinkCo = coOf("thinking");
  const modeValue = (client.modes && client.modes.currentModeId) || (modeCo && modeCo.currentValue) || "";
  const modeOptions =
    client.modes && client.modes.availableModes && client.modes.availableModes.length
      ? client.modes.availableModes.map((m) => ({ value: m.id, name: m.name || m.id }))
      : (modeCo && modeCo.options) || [];
  const sel = (title, value, options, onChange) =>
    options && options.length
      ? e(
          "select",
          { className: "pw-acp-sel", title, value, onChange: (ev) => onChange(ev.target.value) },
          options.map((o) => e("option", { key: o.value, value: o.value }, o.name || o.value)),
        )
      : null;
  /* 上下文用量条（usage_update） */
  const pct = client.usage && client.usage.size ? Math.min(100, Math.round((client.usage.used / client.usage.size) * 100)) : 0;
  const kfmt = (n) => (n >= 1000 ? (n / 1024).toFixed(n >= 10240 ? 0 : 1) + "k" : String(n));
  /* 历史会话：kimi 的 session/list 不按 cwd 过滤（实测），前端过滤 */
  const histList = (client.sessions || [])
    .filter((s) => s && s.sessionId && s.cwd === client.cwd)
    .sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  /* 斜杠命令补全：draft 以 / 开头且不含空白时弹出；kimi 会把全部技能暴露成 /skill:*（实测 72 条），
   * 用子串模糊匹配（不区分大小写），弹窗可滚动、键盘全量导航 */
  const slashQ = draft.slice(1).toLowerCase();
  const slashAll =
    !slashOff && draft.charAt(0) === "/" && !/\s/.test(draft)
      ? client.commands.filter((c) => c && c.name && (slashQ === "" || c.name.toLowerCase().indexOf(slashQ) >= 0))
      : [];
  const sIdx = Math.min(slashIdx, Math.max(0, slashAll.length - 1));
  /* 发送语义按状态分派（参考 Cursor 排队/引导交互，用户决策 2026-08）：
   * 空闲=直接发；运行中 Enter/后续消息=入队（轮次结束自动补发）；引导=cancel 后回发；
   * 断线=入队并立即触发重连，连回（hello/loaded）后自动补发 */
  const send = () => {
    const text = draft.trim();
    if (!text && !images.length) return;
    if (client.status === "dead") {
      client.enqueue(text, images);
      client.reconnect();
    } else if (client.status === "running" || client.status === "waiting") client.enqueue(text, images);
    else client.sendPrompt(text, images);
    setDraft("");
    setImages([]);
    setSlashIdx(0);
  };
  const steer = () => {
    const text = draft.trim();
    if (!text && !images.length) return;
    client.steerNow(text, images);
    setDraft("");
    setImages([]);
    setSlashIdx(0);
  };
  const pickSlash = (c) => {
    setDraft("/" + c.name + " ");
    setSlashIdx(0);
  };
  /* 读图入队（文件选择 / 剪贴板粘贴共用）：超 4 张静默丢弃，host 侧另有 8MB/张守卫 */
  const addImageFile = (f) => {
    if (!f || !/^image\//.test(f.type)) return;
    const rd = new FileReader();
    rd.onload = () => {
      const url = String(rd.result || "");
      const comma = url.indexOf(",");
      if (comma < 0) return;
      setImages((cur) => (cur.length >= 4 ? cur : cur.concat([{ url, data: url.slice(comma + 1), mimeType: f.type }]).slice(0, 4)));
    };
    rd.readAsDataURL(f);
  };
  const onFiles = (ev) => {
    Array.prototype.slice.call(ev.target.files || []).forEach(addImageFile);
    ev.target.value = "";
  };
  /* Cmd/Ctrl+V 直接粘贴截图/图片文件；纯文本剪贴板不拦截，走默认粘贴 */
  const onPaste = (ev) => {
    const cd = ev.clipboardData;
    if (!cd) return;
    const items = Array.prototype.slice.call(cd.items || []).filter((it) => it.kind === "file" && /^image\//.test(it.type));
    if (!items.length) return;
    ev.preventDefault();
    items.forEach((it) => addImageFile(it.getAsFile()));
  };
  const imageCap = !!(client.capabilities && client.capabilities.promptCapabilities && client.capabilities.promptCapabilities.image);
  /* 消息悬停操作条：只有复制（用户与 AI 消息同款）。已复制反馈按 item.key 记 */
  const copyText = (t) => {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    const ta = document.createElement("textarea");
    ta.value = t;
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand("copy"); } catch (_) { /* 忽略 */ }
    ta.remove();
    return Promise.resolve();
  };
  const copyMsg = (it) => {
    copyText(it.text || "");
    setCopiedKey(it.key);
    setTimeout(() => setCopiedKey((k) => (k === it.key ? null : k)), 1200);
  };
  const msgActs = (it) =>
    e(
      "div",
      { className: "pw-acp-acts" },
      e(
        "button",
        { className: "pw-acp-act" + (copiedKey === it.key ? " ok" : ""), title: "复制内容", onClick: () => copyMsg(it) },
        copiedKey === it.key ? CheckIcon(11) : CopyIcon(11),
        copiedKey === it.key ? "已复制" : "复制",
      ),
    );
  /* 顶部控制条已按用户决策移除（2026-08）：头条干扰阅读输出，名字/状态与 tab 重复。
   * 布局：会话操作（＋新增/历史/分叉）在输入区图片钮左方；模式（左）与模型/思考/上下文（右）
   * 在输入区下沿控制行；上下文为紧凑指示器，点击展开明细浮层（主对话同款交互）。 */
  return e(
    "div",
    { className: "pw-acp" },
    client.status === "dead"
      ? e(
          "div",
          { className: "pw-acp-dead" },
          e(
            "span",
            { className: "pw-acp-dead-text" },
            client.reconnecting ? "连接已断开，正在自动重连（第 " + client.reconnecting + " 次）…" : client.fatal || "agent 进程已退出 / 连接已断开",
          ),
          e("button", { className: "pw-btn-plain", onClick: () => client.reconnect() }, "立即重连"),
        )
      : null,
    e(
      "div",
      { className: "pw-acp-stream", ref: scrollRef },
      client.items.map((it) =>
        it.kind === "tool"
          ? e(
              "div",
              { key: it.key, className: "pw-acp-tool st-" + it.status, title: it.arg || it.title },
              e("span", { className: "pw-acp-tool-status" }, TOOL_STATUS[it.status] || it.status),
              e("span", { className: "pw-acp-tool-title" }, it.title),
              /* kimi 的 Bash 类标题是 "Running: <命令>"，与提取的 arg 重复——标题已含 arg 就不再重复显示 */
              it.arg && it.title.indexOf(it.arg) < 0 ? e("span", { className: "pw-acp-tool-arg" }, shortArg(it.arg)) : null,
              it.output
                ? e(
                    "details",
                    { className: "pw-acp-tool-out" },
                    e("summary", null, "输出"),
                    e("pre", null, it.output.length > 2000 ? it.output.slice(0, 2000) + "\n…（截断）" : it.output),
                  )
                : null,
            )
          : it.kind === "plan"
            ? e("pre", { key: it.key, className: "pw-acp-plan" }, it.text)
            : it.kind === "note"
              ? e("div", { key: it.key, className: "pw-acp-note" }, it.text)
              : it.kind === "error"
                ? e("div", { key: it.key, className: "pw-acp-error" }, it.text)
                : it.kind === "agent"
                  ? /* agent 正文按 markdown 渲染（复用预览栏渲染器；user 回声/think 保持纯文本）。
                     * 流式中途的未闭合围栏/半行语法由渲染器自然降级为原文，下一 chunk 到来即自愈 */
                  e(
                    "div",
                    { key: it.key, className: "pw-acp-msgw agent" },
                    e("div", { className: "pw-acp-msg agent pw-acp-md" }, renderMarkdown(stripCompactNotice(it.text), null, client.cwd)),
                    msgActs(it),
                  )
                  : it.kind === "user"
                    ? e(
                        "div",
                        { key: it.key, className: "pw-acp-msgw user" },
                        e(
                          "div",
                          { className: "pw-acp-msg user" },
                          it.images && it.images.length
                            ? e(
                                "span",
                                { className: "pw-acp-imgs" },
                                it.images.map((im, i) => e("img", { key: i, className: "pw-acp-thumb", src: im.url })),
                              )
                            : null,
                          it.text,
                        ),
                        msgActs(it),
                      )
                    : /* thought 等其余条目保持裸气泡（无操作条） */
                      e("div", { key: it.key, className: "pw-acp-msg " + it.kind }, it.text),
      ),
      client.perm
        ? e(
            "div",
            { className: "pw-acp-perm" },
            e("div", { className: "pw-acp-perm-title" }, client.perm.title),
            e(
              "div",
              { className: "pw-acp-perm-opts" },
              (client.perm.options || []).map((o) =>
                e(
                  "button",
                  {
                    key: o.optionId || o.id || o.name,
                    className: "pw-btn-plain",
                    onClick: () => client.answerPermission(client.perm.requestId, o.optionId || o.id || o.name),
                  },
                  o.name || o.optionId || o.id,
                ),
              ),
            ),
          )
        : null,
    ),
    images.length
      ? e(
          "div",
          { className: "pw-acp-chips" },
          images.map((im, i) =>
            e(
              "span",
              { key: i, className: "pw-acp-chip" },
              e("img", { src: im.url }),
              e(
                "span",
                { className: "pw-acp-chip-x", title: "移除", onClick: () => setImages((cur) => cur.filter((_, j) => j !== i)) },
                "×",
              ),
            ),
          ),
        )
      : null,
    histOpen
      ? e(
          "div",
          { className: "pw-acp-hist" },
          client.historyBusy
            ? e("div", { className: "pw-hint" }, "加载中…")
            : histList.length
              ? histList.map((s) =>
                  e(
                    "button",
                    {
                      key: s.sessionId,
                      className: "pw-acp-hist-row" + (s.sessionId === client.sessionId ? " cur" : ""),
                      title: s.sessionId,
                      onClick: () => {
                        setHistOpen(false);
                        client.loadSession(s.sessionId);
                      },
                    },
                    e("span", { className: "pw-acp-hist-title" }, s.title || "(无标题)"),
                    e("span", { className: "pw-acp-hist-time" }, relTime(Date.parse(s.updatedAt || "") || 0)),
                    /* 删除：两击确认；当前会话不显示（成功帧 session_deleted 会把行移除） */
                    s.sessionId !== client.sessionId
                      ? e(
                          "span",
                          {
                            className: "pw-acp-hist-del" + (delId === s.sessionId ? " confirm" : ""),
                            title: delId === s.sessionId ? "再次点击确认删除" : "删除该会话",
                            onClick: (ev) => {
                              ev.stopPropagation();
                              if (delId === s.sessionId) {
                                setDelId(null);
                                client.deleteSession(s.sessionId);
                              } else {
                                setDelId(s.sessionId);
                              }
                            },
                          },
                          delId === s.sessionId ? "删?" : "×",
                        )
                      : null,
                  ),
                )
              : e("div", { className: "pw-hint" }, "该目录下没有历史会话"),
        )
      : null,
    /* 已排队面板（参考截图交互）：左侧计数，右侧"移回输入框"（取回最近一条到草稿） */
    client.queue.length
      ? e(
          "div",
          { className: "pw-acp-queue" },
          e(
            "div",
            { className: "pw-acp-queue-head" },
            e("span", { className: "pw-acp-queue-n" }, "已排队 · " + client.queue.length),
            e(
              "button",
              {
                className: "pw-acp-hbtn",
                title: "把最近一条排队消息移回输入框",
                onClick: () => {
                  const m = client.popQueue();
                  if (m) {
                    setDraft(m.text);
                    setImages(m.images || []);
                  }
                },
              },
              "移回输入框",
            ),
          ),
          client.queue.map((m, i) =>
            e("div", { key: i, className: "pw-acp-queue-item", title: m.text }, (m.images && m.images.length ? "[图×" + m.images.length + "] " : "") + (m.text || "(空)")),
          ),
        )
      : null,
    e(
      "div",
      { className: "pw-acp-composer" },
      slashAll.length
        ? e(
            "div",
            { className: "pw-acp-slash" },
            slashAll.map((c, i) =>
              e(
                "button",
                {
                  key: c.name,
                  className: "pw-acp-slash-row" + (i === sIdx ? " cur" : ""),
                  /* 键盘导航时让选中行滚进可视区 */
                  ref: i === sIdx ? (el) => el && el.scrollIntoView({ block: "nearest" }) : null,
                  onMouseDown: (ev) => {
                    ev.preventDefault();
                    pickSlash(c);
                  },
                },
                e("span", { className: "pw-acp-slash-name" }, "/" + c.name),
                e("span", { className: "pw-acp-slash-desc", title: c.description || "" }, String(c.description || "").split("\n")[0]),
              ),
            ),
          )
        : !slashOff && draft.charAt(0) === "/" && !/\s/.test(draft)
          ? e(
              "div",
              { className: "pw-acp-slash" },
              e("div", { className: "pw-acp-slash-empty" }, client.commands.length ? "无匹配命令" : "命令加载中…"),
            )
          : null,
      /* 输入框独立成框（用户决策）：运行中也可输入——占位提示 引导/排队 双出口 */
      e("input", { ref: fileRef, type: "file", accept: "image/*", multiple: true, style: { display: "none" }, onChange: onFiles }),
      e("input", {
        value: draft,
        placeholder:
          client.status === "running" || client.status === "waiting"
            ? "立即引导 / 排队后续消息…"
            : client.status === "dead"
              ? "连接已断开——输入后回车将自动重连并发送"
              : imageCap
                ? "向 Kimi Code 发送指令…（/ 命令，可粘贴图片）"
                : "向 Kimi Code 发送指令…（/ 命令）",
        onChange: (ev) => {
          setDraft(ev.target.value);
          setSlashIdx(0);
          setSlashOff(false);
        },
        onPaste: imageCap ? onPaste : undefined,
        onKeyDown: (ev) => {
          if (ev.isComposing) return;
          if (slashAll.length && (ev.key === "ArrowDown" || ev.key === "ArrowUp")) {
            ev.preventDefault();
            setSlashIdx((i) => (i + (ev.key === "ArrowDown" ? 1 : -1) + slashAll.length) % slashAll.length);
          } else if (slashAll.length && (ev.key === "Tab" || ev.key === "Enter")) {
            ev.preventDefault();
            pickSlash(slashAll[sIdx]);
          } else if (ev.key === "Escape") {
            setSlashOff(true);
          } else if (ev.key === "Enter") {
            send();
          }
        },
        }),
      client.status === "running" || client.status === "waiting"
        ? [
            e(
              "button",
              { key: "steer", className: "pw-acp-mini", title: "引导：打断当前任务，立即处理这条消息", disabled: !draft.trim() && !images.length, onClick: steer },
              "引导",
            ),
            e(
              "button",
              { key: "queue", className: "pw-acp-mini", title: "后续消息：加入队列，当前任务结束后自动发送", disabled: !draft.trim() && !images.length, onClick: send },
              "后续消息",
            ),
          ]
        : e("button", { className: "pw-btn-primary", disabled: !draft.trim() && !images.length, onClick: send }, "发送"),
    ),
    /* 控制行（框外下方）：会话操作（新对话/历史/分叉/图片）+ 模式（左）；模型/思考/上下文/停止（右）。
     * 浮层数据只有 usage_update 的 {used,size}——ACP 不提供系统提示词/工具分项，明细从简 */
    e(
      "div",
      { className: "pw-acp-controls" },
      e(
        "button",
        { className: "pw-acp-hbtn", title: "新对话（同目录开一个空白 Kimi 会话）", disabled: client.busy(), onClick: () => client.newSession() },
        "新对话",
      ),
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-hist-btn" + (histOpen ? " on" : ""),
            title: "历史会话（该目录下的 Kimi 会话，可恢复）",
            onClick: () => {
              const v = !histOpen;
              setHistOpen(v);
              /* 替换式弹出：开历史收 usage（外点监听护住开关按钮，
               * 互斥只能放在按钮自己的 click 里） */
              if (v) { client.listSessions(); setUsageOpen(false); }
            },
          },
          "历史",
        ),
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-ibtn",
            title: "分叉当前会话（复制出带完整上下文的副本，原会话保留）",
            disabled: client.busy(),
            onClick: () => client.forkSession(),
          },
          GitBranchIcon(11),
        ),
        imageCap
          ? e(
              "button",
              { className: "pw-acp-attach", title: "附加图片（最多 4 张）", onClick: () => fileRef.current && fileRef.current.click() },
              ImageIcon(14),
            )
          : null,
        sel("模式（default/plan/auto/yolo）", modeValue, modeOptions, (v) => client.setMode(v)),
        e("span", { className: "pw-bpanel-flex" }),
        modelCo ? sel("模型", modelCo.currentValue, modelCo.options, (v) => client.setConfig("model", v)) : null,
        thinkCo ? sel("Thinking 档位", thinkCo.currentValue, thinkCo.options, (v) => client.setConfig("thinking", v)) : null,
        /* 压缩上下文：发送 kimi 内建 /compact（已实测暴露在 available_commands）。
         * 参照 pi-web ChatInput：压缩中图标换实心停止块、点击=中止（onCompact/onAbort 切换） */
        e(
          "button",
          {
            className: "pw-acp-hbtn pw-acp-ibtn pw-acp-compact" + (client.compacting ? " ing" : ""),
            title: client.compacting ? "中止压缩" : "压缩上下文（发送 /compact：总结历史、释放上下文窗口，原会话内容随之精简）",
            disabled: client.busy() && !client.compacting,
            onClick: () => (client.compacting ? client.cancel() : client.sendPrompt("/compact")),
          },
          client.compacting ? StopIcon(11) : MinimizeIcon(11),
          client.compacting ? "压缩中…" : "压缩",
        ),
        client.usage && client.usage.size
        ? e(
            "button",
            {
              className: "pw-acp-usage" + (pct >= 80 ? " hot" : "") + (usageOpen ? " on" : ""),
              title: "上下文占用，点击展开明细",
              onClick: () => {
                /* 替换式弹出：开 usage 收历史（外点监听护住开关按钮，
                 * 互斥只能放在按钮自己的 click 里） */
                const v = !usageOpen;
                setUsageOpen(v);
                if (v) setHistOpen(false);
              },
            },
            /* 圆环占用指示（对齐 Kimi 原生应用）：pathLength 归一到 100，
             * dasharray 第一段即百分比；≥80% 走 error 色（沿用原 hot 语义） */
            e(
              "svg",
              { className: "pw-acp-usage-ring", viewBox: "0 0 20 20", "aria-hidden": "true" },
              e("circle", { className: "pw-acp-usage-ring-track", cx: 10, cy: 10, r: 8 }),
              e("circle", {
                className: "pw-acp-usage-ring-arc" + (pct >= 80 ? " hot" : ""),
                cx: 10, cy: 10, r: 8,
                pathLength: 100,
                strokeDasharray: pct + " " + (100 - pct),
                transform: "rotate(-90 10 10)",
              }),
            ),
            e("span", { className: "pw-acp-usage-text" }, pct + "%"),
          )
        : null,
      /* 红色停止（用户决策：不叫取消；运行/等待中出现，位于控制行右端） */
      client.status === "running" || client.status === "waiting"
        ? e("button", { className: "pw-acp-stop", title: "停止当前任务", onClick: () => client.cancel() }, "■ 停止")
        : null,
      usageOpen && client.usage && client.usage.size
        ? e(
            "div",
            { className: "pw-acp-pop" },
            e("div", { className: "pw-acp-pop-title" }, "上下文已用 " + pct + "%"),
            e(
              "div",
              { className: "pw-acp-pop-bar" },
              e("div", { className: "pw-acp-usage-fill" + (pct >= 80 ? " hot" : ""), style: { width: pct + "%" } }),
            ),
            e("div", { className: "pw-acp-pop-num" }, kfmt(client.usage.used) + " / " + kfmt(client.usage.size) + " tokens"),
          )
        : null,
      ),
  );
}

/* ==================== 下侧边栏（助手面板）：终端 + 智能体 tabs ====================
 * 吸底面板，只占会话列（跟踪 .pI_x6G_centerCol 的矩形定位，打开时给会话列底部
 * padding 形成挤压，滑入滑出对齐侧栏节奏）。tab 栏：Kimi 智能体 tabs 居左（＋号选目录接入，
 * tab 上显示 agent 实时状态点，× 关闭并回收进程），「终端」与关闭钮居右。高度顶边拖拽并 localStorage 记忆。
 * 智能体连接/状态在 15-acp.js 的 AcpClient（纯 JS，面板关闭也不断连）。
 * bottomPanel / bottomArea store 在 01-stores.js（避免跨文件 TDZ）。
 * 兼容机制：bottomArea.owner 被第三方占位（dshBottomPanels.acquire）期间让位——
 * 渲染 null 且撤掉挤压 padding；释放后自动归位（open/tab/height/终端与 agent 连接全保留）。 */

/* xterm 配色：表面色走平台 token，16 色 ANSI 用 one-dark/one-light 调色板（同参考实现） */
const ANSI_DARK = {
  black: "#282c34", red: "#e06c75", green: "#98c379", yellow: "#e5c07f",
  blue: "#61afef", magenta: "#c678dd", cyan: "#56b6c2", white: "#abb2bf",
  brightBlack: "#5c6370", brightRed: "#e06c75", brightGreen: "#98c379",
  brightYellow: "#e5c07f", brightBlue: "#61afef", brightMagenta: "#c678dd",
  brightCyan: "#56b6c2", brightWhite: "#ffffff",
};
const ANSI_LIGHT = {
  black: "#383a42", red: "#e45649", green: "#50a14f", yellow: "#c18401",
  blue: "#0184bc", magenta: "#a626a4", cyan: "#0997b3", white: "#a0a1a7",
  brightBlack: "#4f525e", brightRed: "#e45649", brightGreen: "#50a14f",
  brightYellow: "#c18401", brightBlue: "#0184bc", brightMagenta: "#a626a4",
  brightCyan: "#0997b3", brightWhite: "#fafafa",
};
function termTheme() {
  const cs = getComputedStyle(document.body);
  const dark = document.body.hasAttribute("data-ds-dark-theme");
  const background = cs.getPropertyValue("--dsw-alias-bg-base").trim() || (dark ? "#111114" : "#ffffff");
  const foreground = cs.getPropertyValue("--dsw-alias-label-primary").trim() || (dark ? "#e6e6e6" : "#1a1a1a");
  return {
    background,
    foreground,
    cursor: foreground,
    cursorAccent: background,
    selectionBackground: dark ? "rgba(255,255,255,.22)" : "rgba(0,0,0,.12)",
    ...(dark ? ANSI_DARK : ANSI_LIGHT),
  };
}

/* 终端视图：xterm + WS 连接 host pty；断线自动重连（1011+reason 显示错误横幅） */
function TerminalView() {
  const e = React.createElement;
  const hostRef = React.useRef(null);
  const [fatal, setFatal] = React.useState(null);
  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    const XT = window.__pwXterm;
    if (!XT) {
      setFatal("xterm 未加载");
      return undefined;
    }
    const term = new XT.Terminal({
      cursorBlink: true,
      fontSize: 12,
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
      scrollback: 4000,
      allowTransparency: true,
      theme: termTheme(),
    });
    const fit = new XT.FitAddon();
    term.loadAddon(fit);
    term.open(host);
    const applyTheme = () => {
      term.options.theme = termTheme();
    };
    const mo = new MutationObserver(applyTheme);
    mo.observe(document.body, { attributes: true, attributeFilter: ["data-ds-dark-theme"] });
    let socket = null,
      closed = false,
      failures = 0,
      retryTimer = 0;
    const wsUrl = () => {
      const u = new URL("/__dsh-geek-sidebar__/wb/terminal-ws", location.origin);
      u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
      const p = new URLSearchParams({ sessionId: sessionProbe.sid || "_", tab: "assistant" });
      if (currentRootPath) p.set("cwd", currentRootPath);
      u.search = p.toString();
      return u.toString();
    };
    const sendResize = () => {
      if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: "resize", cols: term.cols, rows: term.rows }));
    };
    const connect = () => {
      if (closed) return;
      socket = new WebSocket(wsUrl());
      socket.onopen = () => {
        failures = 0;
        setFatal(null);
        try {
          fit.fit();
        } catch (e2) {}
        sendResize();
      };
      socket.onmessage = (ev) => {
        if (typeof ev.data === "string") term.write(ev.data);
      };
      socket.onclose = (ev) => {
        if (closed) return;
        if (ev.code === 1011 && ev.reason) {
          setFatal(ev.reason);
          return;
        }
        failures++;
        if (failures > 3) {
          setFatal("终端连接失败（code " + ev.code + "）");
          return;
        }
        retryTimer = setTimeout(connect, 1200);
      };
      socket.onerror = () => {};
    };
    const inputSub = term.onData((d) => {
      if (socket && socket.readyState === 1) socket.send(d);
    });
    const ro = new ResizeObserver(() => {
      try {
        fit.fit();
        sendResize();
      } catch (e3) {}
    });
    ro.observe(host);
    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      try {
        ro.disconnect();
      } catch (e4) {}
      try {
        mo.disconnect();
      } catch (e5) {}
      try {
        inputSub.dispose();
      } catch (e6) {}
      try {
        if (socket) socket.close();
      } catch (e7) {}
      try {
        term.dispose();
      } catch (e8) {}
    };
  }, []);
  return e(
    "div",
    { className: "pw-term-wrap" },
    e("div", { ref: hostRef, className: "pw-term-host" }),
    fatal ? e("div", { className: "pw-term-fatal" }, fatal) : null,
  );
}

/* 面板骨架：tab 栏（智能体 tabs + ＋号接入 → 右端 终端 tab + 关闭钮）+ 内容区。
 * 开合对齐左右侧栏：首次打开后常驻挂载，transform 滑入滑出（不触发重排、xterm 不重建），
 * 挤压走 padding-bottom 过渡；时长/缓动复用平台 token，与 AppFrame 列宽过渡同节奏。
 * 常驻挂载的代价：终端 WS 与 xterm 关栏后保活（换来 scrollback 保留与无闪回）。 */
function BottomPanel(t) {
  const e = React.createElement;
  const [, force] = React.useState(0);
  React.useEffect(() => bus.sub(() => force((x) => x + 1)), []);
  const [rect, setRect] = React.useState(null);
  /* 首次打开才挂载（否则终端 PTY 会随页面加载白起）；双 rAF 让首帧以 off 态绘制再滑入 */
  const [mounted, setMounted] = React.useState(false);
  const [entered, setEntered] = React.useState(false);
  React.useEffect(() => {
    if (!bottomPanel.open || mounted) return undefined;
    setMounted(true);
    const t2 = requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)));
    return () => cancelAnimationFrame(t2);
  }, [bottomPanel.open, mounted]);
  /* 跟踪会话列矩形：面板只覆盖其底部区域（左右侧栏不动） */
  React.useEffect(() => {
    const col = document.querySelector(".pI_x6G_centerCol");
    if (!col) return undefined;
    const update = () => {
      const r = col.getBoundingClientRect();
      setRect({ left: Math.round(r.left), width: Math.round(r.width) });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(col);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
    };
  }, []);
  /* 挤压：打开时给会话列底部 padding（过渡与面板滑移同节奏），关闭/让位归零 */
  const yielded = bottomArea.isYielded();
  React.useEffect(() => {
    const col = document.querySelector(".pI_x6G_centerCol");
    if (!col) return undefined;
    if (!col.style.transition) col.style.transition = "padding-bottom var(--ds-transition-duration-slow) var(--ds-ease-in-out)";
    col.style.paddingBottom = bottomPanel.open && !yielded ? bottomPanel.height + "px" : "0px";
  }, [bottomPanel.open, bottomPanel.height, yielded]);
  if (!mounted || !rect || yielded) return null;
  const startDrag = (ev) => {
    ev.preventDefault();
    const startY = ev.clientY,
      startH = bottomPanel.height;
    const mv = (e2) => {
      const h = Math.min(Math.max(140, startH + (startY - e2.clientY)), Math.round(window.innerHeight * 0.85));
      bottomPanel.set({ height: h });
    };
    const up = () => {
      document.removeEventListener("mousemove", mv);
      document.removeEventListener("mouseup", up);
      try {
        window.localStorage.setItem("pw-bpanel-h", String(bottomPanel.height));
      } catch (e9) {}
    };
    document.addEventListener("mousemove", mv);
    document.addEventListener("mouseup", up);
  };
  /* ＋ 接入 Kimi Code：选目录 → 建 tab（AcpClient 立即连 WS 起进程） */
  const addAgent = () => {
    const svc = t.workspacesSvc;
    if (!svc || typeof svc.pickDirectory !== "function") return;
    svc
      .pickDirectory()
      .then((n) => {
        if (n) acpTabs.add(n);
      })
      .catch(() => {});
  };
  const tab = bottomPanel.tab;
  const activeClient = tab !== "terminal" ? acpTabs.clients[tab] || null : null;
  return e(
    "div",
    { className: "pw-bpanel" + (bottomPanel.open && entered ? "" : " off"), style: { left: rect.left, width: rect.width, height: bottomPanel.height } },
    e("div", { className: "pw-bpanel-drag", title: "拖拽调整高度", onMouseDown: startDrag }),
    e(
      "div",
      { className: "pw-bpanel-tabs" },
      acpTabs.tabs.map((tb) => {
        const c = acpTabs.clients[tb.id];
        const st = c ? c.status : "connecting";
        return e(
          "span",
          {
            key: tb.id,
            className: "pw-bpanel-tab pw-bpanel-atab" + (tab === tb.id ? " on" : ""),
            title: tb.cwd + "\nKimi Code：" + (ACP_STATUS[st] || ACP_STATUS.connecting).label,
            onClick: () => bottomPanel.set({ tab: tb.id }),
          },
          e("span", { className: "pw-tab-dot " + st }),
          e("span", { className: "pw-tab-name" }, tb.name),
          e(
            "span",
            {
              className: "pw-tab-x",
              title: "关闭（断开并回收 agent 进程）",
              onClick: (ev) => {
                ev.stopPropagation();
                acpTabs.close(tb.id);
              },
            },
            "×",
          ),
        );
      }),
      e("button", { className: "pw-bpanel-add", title: "接入 Kimi Code：选择目录", onClick: addAgent }, "＋"),
      e("span", { className: "pw-bpanel-flex" }),
      /* 终端挪右端：智能体 tabs 是主角居左；关闭钮与左右侧栏同族（» 转 90° 向下） */
      e(
        "button",
        { className: "pw-bpanel-tab" + (tab === "terminal" ? " on" : ""), onClick: () => bottomPanel.set({ tab: "terminal" }) },
        "终端",
      ),
      e(
        "button",
        { className: "pw-bpanel-col", title: "收起下栏", onClick: () => bottomPanel.set({ open: false }) },
        e("span", { className: "pw-bpanel-col-arrow" }, "»"),
      ),
    ),
    e(
      "div",
      { className: "pw-bpanel-body" },
      tab === "terminal" || !activeClient ? e(TerminalView, null) : e(AgentTabView, { client: activeClient }),
    ),
  );
}

return {
  apply(t) {
    const e = t.get("slots");
    if (e === void 0) return;
    const s = t.get("layout"),
      o = t.get("sessions"),
      a = t.get("workspaces");
    (mountStyle(API + "/wb/style.css"),
      host
        .call("workbench.notesGet", {})
        .then((u) => {
          u && notesStore.set(u);
        })
        .catch(() => {}));
    const l = fileMentionBridge;
    /* details 面板仲裁服务：第三方经 ctx.inject(['dshDetailsPanels'], cb) 接入；
       register() 返回的注销函数须挂到消费方自己的 ctx.effect。 */
    t.provide("dshDetailsPanels");
    t.dshDetailsPanels = {
      register: (def) => panelStore.register(def),
      open: (id) => panelStore.open(id),
      close: (id) => panelStore.close(id),
      isOpen: (id) => panelStore.isOpen(id),
    };
    /* 底部区域仲裁服务：第三方经 ctx.inject(['dshBottomPanels'], cb) 接入。
       acquire(id) 独占占位（排他，被占即 false），占位期间我们的底部面板让位
       （渲染 null + 撤挤压，open 状态保留）；release(id) 归还后自动归位。
       对齐右栏 details 单槽 priority 的让位语义——shell.overlay 是多槽，无平台仲裁，故自建。 */
    t.provide("dshBottomPanels");
    t.dshBottomPanels = {
      acquire: (id) => bottomArea.acquire(id),
      release: (id) => bottomArea.release(id),
      owner: () => bottomArea.owner,
      isYielded: () => bottomArea.isYielded(),
    };
    /* @文件引用走 rc.8 原生 ui-reference 源（reference 组），插件不再注册
       * 自有 workbenchFile 组（v1.16.0 起移除，能力重叠）。
       * 侧栏"提及"仍走 dshFileMention 桥（insert-text 纯文本路径，原生无对应物）。 */
    (e.inject("sidebar.workspaces", () =>
        e.register({ name: "sidebar.workspaces", priority: -5 }, (u) =>
          React.createElement(Sidebar, {
            wide: u.wide,
            useSessions: u.useSessions,
            useWorkspaces: u.useWorkspaces,
            layout: s,
            sessionsSvc: o,
            workspacesSvc: a,
            mentionBridge: l,
          }),
        ),
      ),
      e.inject("sidebar.footer.action", () =>
        e.register(
          {
            name: "sidebar.footer.action",
            id: "workbench-footbar",
            order: 100,
          },
          (u) =>
            React.createElement(FootBar, {
              wide: u.wide,
              onSkills: () => skillsUI.open(currentRootPath || ""),
            }),
        ),
      ),
      e.inject("details", () =>
        /* single 槽 priority 最小者渲染：-0.5 压过官方默认（0），同时输给 dsh-gtm 抽屉（-1，
           打开才注册）——它开我们让位、它关我们归位。-1 与 0 之间只有小数可用。 */
        e.register({ name: "details", priority: -0.5 }, (u) =>
          React.createElement(PanelHost, {
            sessionId: u.sessionId,
            layout: s,
            workspacesSvc: a,
            mentionBridge: l,
          }),
        ),
      ),
      e.inject("shell.overlay", () =>
        e.register({ name: "shell.overlay", id: "workbench-bottom-panel" }, () => React.createElement(BottomPanel, { workspacesSvc: a })),
      ),
      e.inject("shell.overlay", () =>
        e.register(
          { name: "shell.overlay", id: "workbench-preview-drawer" },
          (u) =>
            React.createElement(PreviewDrawer, {
              layout: s,
              workspacesSvc: a,
              mentionBridge: l,
              /* 框架全局份额：drawer 用它判断官方 details 栏是否被会话门钳 0 */
              useSessions: u.useSessions,
            }),
        ),
      ));
  },
};

})(React, host)

    /* ============================ feature 3: skills ============================ */
    const V = {
      bg: 'var(--dsw-alias-bg-base)',
      panel: 'var(--dsw-alias-bg-layer-1)',
      selected: 'var(--dsw-alias-bg-layer-2)',
      border: 'var(--dsw-alias-border-l1)',
      text: 'var(--dsw-alias-label-primary)',
      muted: 'var(--dsw-alias-label-secondary)',
      accent: 'var(--dsw-alias-button-info-fill, var(--dsw-alias-brand-primary))', /* brand-primary 在亮色主题近黑；button-info-fill 才是 DeepSeek 蓝 */
      error: 'var(--dsw-alias-state-error-primary)',
      warn: '#d97706',
      ok: '#16a34a',
    }
    const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace'

    function shortenPath(p) { return String(p || '').replace(/^\/(?:Users|home)\/[^/]+/, '~') }
    function shortVersion(v) { return v ? String(v).slice(0, 8) : 'unknown' }
    function updateKey(skill) { return skill.install ? skill.install.scope + '\0' + skill.install.package : null }
    function groupOf(skill) {
      const sh = Boolean(skill.install && skill.install.skillsShUrl)
      return skill.scope + (sh ? ' / skills.sh' : '')
    }

    const api2 = (method, path, body) => api(method, '/skills' + path, body)

    function PlusIcon() {
      return h('svg', { width: 13, height: 13, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('line', { x1: 12, y1: 5, x2: 12, y2: 19 }), h('line', { x1: 5, y1: 12, x2: 19, y2: 12 }))
    }
    function PencilIcon() {
      return h('svg', { width: 11, height: 11, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' },
        h('path', { d: 'M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z' }))
    }
    function Toggle(props) {
      return h('button', {
        onClick: props.onToggle,
        disabled: props.loading,
        title: props.enabled ? '提示词中可见' : '提示词中隐藏（仍可手动调用）',
        style: {
          flexShrink: 0, width: 40, height: 22, borderRadius: 11, border: 'none', padding: 0,
          cursor: props.loading ? 'wait' : 'pointer',
          background: props.enabled ? V.accent : V.border,
          position: 'relative', transition: 'background 0.18s', outline: 'none',
        },
      }, h('span', {
        style: {
          position: 'absolute', top: 3, left: props.enabled ? 21 : 3, width: 16, height: 16,
          borderRadius: '50%', background: V.bg, boxShadow: '0 1px 4px rgba(0,0,0,0.22)',
          transition: 'left 0.18s cubic-bezier(.4,0,.2,1)',
        },
      }))
    }

    function Section(props) {
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 5 } },
        h('span', { style: { fontSize: 12, color: V.muted, fontWeight: 500 } }, props.label),
        props.children)
    }

    function Detail(props) {
      const skill = props.skill
      const enabled = !skill.disableModelInvocation
      const st = props.updateStatus
      const displayPath = skill.scope === 'project' && props.cwd && skill.filePath.indexOf(props.cwd) === 0
        ? './' + skill.filePath.slice(props.cwd.length).replace(/^[/\\]/, '')
        : shortenPath(skill.filePath)
      return h('div', { style: { display: 'flex', flexDirection: 'column', gap: 20 } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 4 } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 7 } },
            h('span', {
              style: {
                fontSize: 10, padding: '1px 5px', borderRadius: 3, flexShrink: 0,
                background: skill.scope === 'project' ? 'rgba(99,102,241,0.12)' : 'rgba(120,120,120,0.12)',
                color: skill.scope === 'project' ? 'rgba(99,102,241,0.9)' : V.muted,
              },
            }, skill.scope),
            h('span', { style: { fontFamily: MONO, fontSize: 11, color: V.muted, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: skill.filePath }, displayPath),
            h(Toggle, { enabled, loading: props.toggling, onToggle: () => props.onToggle(skill) })),
          h('div', { style: { minHeight: 16, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap', textAlign: 'right' } },
            !enabled ? h('span', { style: { fontSize: 11, color: V.muted } }, '已在提示词中隐藏（仍可手动调用）') : null,
            props.saveError ? h('span', { style: { fontSize: 12, color: V.error, overflowWrap: 'anywhere' } }, props.saveError) : null)),
        skill.install && skill.install.skillsShUrl ? h(Section, { label: 'Source' },
          h('a', {
            href: skill.install.skillsShUrl, target: '_blank', rel: 'noreferrer',
            style: { display: 'flex', alignItems: 'center', gap: 8, width: 'fit-content', maxWidth: '100%', color: V.accent, textDecoration: 'none' },
          }, h('span', { style: { fontFamily: MONO, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.install.skillsShUrl.replace(/^https?:\/\//, '') + ' ↗'))) : null,
        skill.install ? h(Section, { label: 'Version' },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
            h('span', { style: { fontFamily: MONO, fontSize: 12, color: V.muted } }, shortVersion(st && st.currentVersion ? st.currentVersion : skill.install.versionHash)),
            skill.install.canCheckForUpdates ? h('button', {
              onClick: props.onCheckUpdate, disabled: props.checkingUpdate || props.updating,
              style: { padding: '4px 9px', border: '1px solid ' + V.border, borderRadius: 5, background: 'none', color: V.muted, cursor: props.checkingUpdate || props.updating ? 'not-allowed' : 'pointer', opacity: props.checkingUpdate || props.updating ? 0.5 : 1, fontSize: 11 },
            }, '检查') : null,
            st && st.state === 'update-available' ? h('span', { style: { fontFamily: MONO, fontSize: 12, color: V.warn } }, shortVersion(st.latestVersion)) : null,
            props.checkingUpdate || (st && st.state !== 'update-available')
              ? h('span', { style: { fontSize: 12, color: props.checkingUpdate ? V.accent : st && st.state === 'up-to-date' ? V.ok : st && st.state === 'error' ? V.error : V.muted } },
                  props.checkingUpdate ? '检查中…' : st && st.state === 'up-to-date' ? '已是最新' : st && st.state === 'unsupported' ? '自动检查不可用' : (st && st.message) || '检查失败')
              : null,
            st && st.state === 'update-available' ? h('button', {
              onClick: props.onUpdate, disabled: props.updating || props.checkingUpdate,
              style: { padding: '4px 10px', border: 'none', borderRadius: 5, background: V.accent, color: '#fff', cursor: props.updating || props.checkingUpdate ? 'not-allowed' : 'pointer', opacity: props.updating || props.checkingUpdate ? 0.5 : 1, fontSize: 11, fontWeight: 600 },
            }, props.updating ? '更新中…' : '更新') : null),
          props.updateError ? h('span', { style: { fontSize: 12, color: V.error } }, props.updateError) : null) : null,
        h(Section, { label: 'Name' }, h('span', { style: { fontFamily: MONO, fontSize: 14, color: V.text } }, skill.name)),
        h(Section, { label: 'Description' }, h('span', { style: { fontSize: 14, color: V.muted, lineHeight: 1.6 } }, skill.description || '—')))
    }

    function AddPanel(props) {
      const [query, setQuery] = useState('')
      const [results, setResults] = useState([])
      const [searching, setSearching] = useState(false)
      const [searchError, setSearchError] = useState(null)
      const [installing, setInstalling] = useState(null)
      const [installError, setInstallError] = useState(null)
      const [installed, setInstalled] = useState(new Set())
      const [scope, setScope] = useState('global')
      const inputRef = useRef(null)
      useEffect(() => { if (inputRef.current) inputRef.current.focus() }, [])

      const search = async () => {
        if (!query.trim()) return
        setSearching(true); setSearchError(null); setResults([])
        try {
          const d = await api2('POST', '/search', { query: query.trim() })
          setResults(d.results || [])
          if (!(d.results || []).length) setSearchError('没有找到匹配的技能')
        } catch (e) { setSearchError(String(e && e.message ? e.message : e)) } finally { setSearching(false) }
      }
      const install = async (pkg) => {
        setInstalling(pkg); setInstallError(null)
        try {
          await api2('POST', '/install', { package: pkg, scope, cwd: props.cwd })
          setInstalled((prev) => new Set(prev).add(scope + ':' + pkg))
          props.onInstalled()
        } catch (e) { setInstallError(String(e && e.message ? e.message : e)) } finally { setInstalling(null) }
      }
      const installPath = scope === 'global' ? shortenPath(props.globalDir) + '/' : shortenPath(props.cwd) + '/.agents/skills/'

      return h('div', { style: { display: 'flex', flexDirection: 'column', height: '100%' } },
        h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 } },
          h('div', { style: { fontSize: 14, fontWeight: 600, color: V.text } }, '添加技能'),
          h('div', { style: { display: 'flex', gap: 8 } },
            h('input', {
              ref: inputRef, value: query, placeholder: '搜索 skills.sh…',
              onChange: (e) => setQuery(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') search() },
              style: { flex: 1, padding: '7px 10px', fontSize: 13, background: V.panel, border: '1px solid ' + V.border, borderRadius: 6, color: V.text, outline: 'none' },
            }),
            h('button', {
              onClick: search, disabled: searching || !query.trim(),
              style: { padding: '7px 16px', fontSize: 13, borderRadius: 6, border: 'none', background: V.accent, color: '#fff', cursor: searching || !query.trim() ? 'not-allowed' : 'pointer', opacity: searching || !query.trim() ? 0.5 : 1, flexShrink: 0 },
            }, searching ? '搜索中…' : '搜索')),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
            h('div', { style: { display: 'flex', borderRadius: 5, border: '1px solid ' + V.border, overflow: 'hidden', fontSize: 12, flexShrink: 0 } },
              ['global', 'project'].map((s2) => h('button', {
                key: s2,
                onClick: () => setScope(s2),
                style: {
                  padding: '3px 10px', border: 'none', cursor: 'pointer',
                  background: scope === s2 ? V.selected : 'none',
                  color: scope === s2 ? V.text : V.muted,
                  fontWeight: scope === s2 ? 600 : 400,
                  borderRight: s2 === 'global' ? '1px solid ' + V.border : 'none',
                },
              }, s2))),
            h('span', { style: { fontSize: 12, color: V.muted, fontFamily: MONO, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, '→ ' + installPath)),
          searchError ? h('div', { style: { fontSize: 12, color: V.error } }, searchError) : null,
          installError ? h('div', { style: { fontSize: 12, color: V.error, wordBreak: 'break-word' } }, installError) : null),
        results.length > 0
          ? h('div', { style: { flex: 1, overflowY: 'auto' } },
              results.map((r) => {
                const isInstalled = props.installedPackages[scope].has(r.package) || installed.has(scope + ':' + r.package)
                const isInstalling = installing === r.package
                const at = r.package.indexOf('@')
                const repo = at > -1 ? r.package.slice(0, at) : r.package
                const skillPart = at > -1 ? r.package.slice(at + 1) : null
                return h('div', { key: r.package, style: { display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid ' + V.border } },
                  h('div', { style: { flex: 1, minWidth: 0 } },
                    h('div', { style: { fontSize: 13, fontWeight: 600, color: V.text, marginBottom: 3 } }, skillPart || repo),
                    h('div', { style: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' } },
                      h('span', { style: { fontFamily: MONO, fontSize: 11, color: V.muted } }, repo),
                      h('span', { style: { fontSize: 12, color: V.muted, fontWeight: 500 } }, r.installs || ''),
                      r.url ? h('a', { href: r.url, target: '_blank', rel: 'noreferrer', style: { fontSize: 12, color: V.accent, textDecoration: 'none' } }, 'skills.sh ↗') : null)),
                  h('button', {
                    onClick: () => { if (!isInstalled && !isInstalling) install(r.package) },
                    disabled: isInstalled || isInstalling || installing !== null,
                    style: {
                      flexShrink: 0, padding: '5px 14px', fontSize: 12, fontWeight: 500, borderRadius: 5,
                      border: '1px solid ' + V.border,
                      cursor: isInstalled || isInstalling || installing !== null ? 'not-allowed' : 'pointer',
                      background: isInstalled ? 'rgba(34,197,94,0.1)' : 'none',
                      color: isInstalled ? V.ok : isInstalling ? V.accent : V.muted,
                    },
                  }, isInstalled ? '✓ 已安装' : isInstalling ? '安装中…' : '安装'))
              }))
          : (!searchError && !searching
              ? h('div', { style: { fontSize: 13, color: V.muted, lineHeight: 1.8 } },
                  '在 ', h('a', { href: 'https://skills.sh', target: '_blank', rel: 'noreferrer', style: { color: V.accent, textDecoration: 'none' } }, 'skills.sh'), ' 搜索并安装技能。')
              : null))
    }

    function SkillsModal() {
      const [open, setOpen] = useState(false)
      const [cwd, setCwd] = useState('')
      const [skills, setSkills] = useState([])
      const [globalDir, setGlobalDir] = useState('')
      const [loading, setLoading] = useState(false)
      const [error, setError] = useState(null)
      const [selected, setSelected] = useState(null)
      const [toggling, setToggling] = useState(new Set())
      const [saveError, setSaveError] = useState(null)
      const [addMode, setAddMode] = useState(false)
      const [statuses, setStatuses] = useState({})
      const [checking, setChecking] = useState(new Set())
      const [updatingKey, setUpdatingKey] = useState(null)
      const [updateError, setUpdateError] = useState(null)
      const [checkingAll, setCheckingAll] = useState(false)
      const [dormantOpen, setDormantOpen] = useState({})
      const [pathEditing, setPathEditing] = useState(false)
      const [pathDraft, setPathDraft] = useState('')

      const load = useCallback(async (forCwd) => {
        setLoading(true); setError(null)
        try {
          const d = await api2('GET', '/list?cwd=' + encodeURIComponent(forCwd || ''))
          const list = d.skills || []
          setSkills(list)
          setGlobalDir(d.globalDir || '')
          setSelected((prev) => {
            if (prev && list.some((s) => s.filePath === prev)) return prev
            const first = list.find((s) => !s.disableModelInvocation) || list[0]
            return first ? first.filePath : null
          })
        } catch (e) { setError(String(e && e.message ? e.message : e)) } finally { setLoading(false) }
      }, [])

      useEffect(() => {
        skillsModalApi = {
          open(forCwd) {
            setCwd(forCwd || '')
            setOpen(true)
            setAddMode(false)
            setStatuses({})
            setUpdateError(null)
            load(forCwd || '')
          },
          close() { setOpen(false) },
        }
        return () => { skillsModalApi = null }
      }, [load])

      const toggle = async (skill) => {
        const next = !skill.disableModelInvocation
        setToggling((s) => new Set(s).add(skill.filePath))
        setSaveError(null)
        try {
          await api2('POST', '/toggle', { filePath: skill.filePath, disable: next })
          setSkills((prev) => prev.map((s) => s.filePath === skill.filePath ? Object.assign({}, s, { disableModelInvocation: next }) : s))
          if (next) setDormantOpen((cur) => Object.assign({}, cur, { [groupOf(skill)]: true }))
        } catch (e) { setSaveError(String(e && e.message ? e.message : e)) } finally {
          setToggling((s) => { const n = new Set(s); n.delete(skill.filePath); return n })
        }
      }

      const updateOne = async (skill) => {
        if (!skill.install) return
        const key = updateKey(skill)
        setUpdatingKey(key); setUpdateError(null)
        try {
          const d = await api2('POST', '/update', { cwd, package: skill.install.package, scope: skill.install.scope })
          await load(cwd)
          setStatuses((cur) => Object.assign({}, cur, { [key]: { state: 'up-to-date', currentVersion: d.versionHash, latestVersion: d.versionHash } }))
        } catch (e) { setUpdateError(String(e && e.message ? e.message : e)) } finally { setUpdatingKey(null) }
      }
      /* 检查只做远端版本比对，不重装；传 skill 则只查单个 */
      const checkForUpdates = async (skill) => {
        const targets = skill ? [skill] : skills.filter((s) => Boolean(s.install))
        const keys = targets.map(updateKey).filter(Boolean)
        if (!keys.length) return
        setUpdateError(null)
        setChecking((cur) => new Set([...cur, ...keys]))
        if (!skill) setCheckingAll(true)
        try {
          const d = await api2('POST', '/check', {
            cwd,
            package: skill && skill.install ? skill.install.package : undefined,
            scope: skill && skill.install ? skill.install.scope : undefined,
          })
          setStatuses((cur) => {
            const next = Object.assign({}, cur)
            for (const u of d.updates || []) next[u.scope + '\0' + u.package] = u
            return next
          })
        } catch (e) {
          setUpdateError(String(e && e.message ? e.message : e))
        } finally {
          setChecking((cur) => { const n = new Set(cur); for (const k of keys) n.delete(k); return n })
          if (!skill) setCheckingAll(false)
        }
      }
      const saveGlobalDir = async () => {
        const dir = pathDraft.trim()
        setPathEditing(false)
        if (!dir || dir === globalDir) return
        try {
          await api2('POST', '/prefs', { globalDir: dir })
          await load(cwd)
        } catch (e) { setError(String(e && e.message ? e.message : e)) }
      }

      if (!open) return null
      const selectedSkill = skills.find((s) => s.filePath === selected) || null
      const groups = []
      const defs = ['project / skills.sh', 'project', 'global / skills.sh', 'global']
      for (const label of defs) {
        const rows = skills.filter((s) => groupOf(s) === label)
        if (rows.length) groups.push({ label, rows })
      }
      const renderRow = (skill) => {
        const isSelected = !addMode && selected === skill.filePath
        const disabled = skill.disableModelInvocation
        return h('div', {
          key: skill.filePath,
          onClick: () => { setSelected(skill.filePath); setAddMode(false) },
          style: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 8px', borderRadius: 5, cursor: 'pointer', background: isSelected ? V.selected : 'none' },
          onMouseEnter: (e) => { if (!isSelected) e.currentTarget.style.background = V.panel },
          onMouseLeave: (e) => { if (!isSelected) e.currentTarget.style.background = 'none' },
        },
          h('span', { style: { flexShrink: 0, width: 7, height: 7, borderRadius: '50%', background: disabled ? V.border : V.accent, boxShadow: disabled ? 'none' : '0 0 4px ' + V.accent, transition: 'background 0.15s, box-shadow 0.15s' } }),
          h('span', { style: { fontSize: 12, fontWeight: isSelected ? 600 : 400, color: disabled ? V.muted : V.text, fontFamily: MONO, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, skill.name),
          /* 可更新标记：行尾橙色 ↑ */
          (() => {
            const key = updateKey(skill)
            const st = key ? statuses[key] : undefined
            if (!st || st.state !== 'update-available') return null
            return h('span', { title: '有可用更新', style: { color: V.warn, fontSize: 13, lineHeight: 1, flexShrink: 0 } }, '↑')
          })())
      }

      return h('div', {
        style: { position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.35)', display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'auto' },
        onClick: (e) => { if (e.target === e.currentTarget) setOpen(false) },
      },
        h('div', {
          style: { width: 860, maxWidth: 'calc(100vw - 16px)', height: '78vh', maxHeight: 'calc(100dvh - 16px)', background: V.bg, border: '1px solid ' + V.border, borderRadius: 10, display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.18)', overflow: 'hidden' },
        },
          /* Header */
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', borderBottom: '1px solid ' + V.border, flexShrink: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 } },
              h('span', { style: { fontSize: 15, fontWeight: 700, color: V.text } }, '技能'),
              h('code', { style: { fontSize: 11, color: V.muted, fontFamily: MONO, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, shortenPath(cwd) || '—'),
              pathEditing
                ? h('input', {
                    value: pathDraft, autoFocus: true,
                    onChange: (e) => setPathDraft(e.target.value),
                    onBlur: saveGlobalDir,
                    onKeyDown: (e) => { if (e.key === 'Enter') saveGlobalDir(); if (e.key === 'Escape') setPathEditing(false) },
                    style: { fontSize: 11, fontFamily: MONO, padding: '2px 6px', border: '1px solid ' + V.accent, borderRadius: 4, background: V.bg, color: V.text, outline: 'none', width: 220 },
                  })
                : h('span', { style: { display: 'inline-flex', alignItems: 'center', gap: 4 } },
                    h('code', { style: { fontSize: 11, color: V.muted, fontFamily: MONO, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }, title: 'global 技能目录' }, shortenPath(globalDir) + '/'),
                    h('button', {
                      onClick: () => { setPathDraft(globalDir); setPathEditing(true) },
                      title: '编辑 global 技能目录',
                      style: { border: 'none', background: 'none', color: V.muted, cursor: 'pointer', padding: 2, display: 'inline-flex' },
                    }, h(PencilIcon)))),
            h('button', { onClick: () => setOpen(false), style: { background: 'none', border: 'none', color: V.muted, cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 6px' } }, '×')),
          /* Body */
          h('div', { style: { flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' } },
            h('div', { style: { width: 210, borderRight: '1px solid ' + V.border, display: 'flex', flexDirection: 'column', flexShrink: 0, background: V.panel } },
              h('div', { style: { flex: 1, overflowY: 'auto', padding: '8px 6px' } },
                loading ? h('div', { style: { padding: '10px 8px', fontSize: 12, color: V.muted } }, '加载中…')
                  : error ? h('div', { style: { padding: '10px 8px', fontSize: 11, color: V.error } }, error)
                  : skills.length === 0 ? h('div', { style: { padding: '10px 8px', fontSize: 11, color: V.muted } }, '没有技能')
                  : groups.map((g) => {
                      const active = g.rows.filter((s) => !s.disableModelInvocation)
                      const dormant = g.rows.filter((s) => s.disableModelInvocation)
                      const dOpen = dormantOpen[g.label] || false
                      return h('div', { key: g.label, style: { marginBottom: 6 } },
                        h('div', { style: { padding: '4px 8px 3px', fontSize: 10, fontWeight: 600, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.06em' } }, g.label),
                        active.map(renderRow),
                        dormant.length > 0 ? h('div', {
                          onClick: () => setDormantOpen((cur) => Object.assign({}, cur, { [g.label]: !dOpen })),
                          style: { display: 'flex', alignItems: 'center', gap: 5, padding: '4px 8px 3px', fontSize: 10, fontWeight: 600, color: V.muted, textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer', userSelect: 'none' },
                        }, h('span', { style: { fontSize: 8 } }, dOpen ? '▾' : '▸'), '已停用 (' + dormant.length + ')') : null,
                        dOpen ? dormant.map(renderRow) : null)
                    })),
              h('div', { style: { padding: '8px 6px', borderTop: '1px solid ' + V.border, flexShrink: 0 } },
                h('div', {
                  onClick: () => setAddMode(true),
                  style: { display: 'flex', alignItems: 'center', gap: 6, padding: '7px 8px', borderRadius: 5, cursor: 'pointer', background: addMode ? V.selected : 'none', color: addMode ? V.accent : V.muted, fontSize: 12 },
                  onMouseEnter: (e) => { if (!addMode) e.currentTarget.style.background = V.selected },
                  onMouseLeave: (e) => { if (!addMode) e.currentTarget.style.background = 'none' },
                }, h(PlusIcon), '添加技能'))),
            h('div', { style: { flex: 1, overflowY: 'auto', padding: 20 } },
              addMode
                ? h(AddPanel, {
                    cwd,
                    globalDir,
                    installedPackages: {
                      global: new Set(skills.filter((s) => s.install && s.install.scope === 'global').map((s) => s.install.package)),
                      project: new Set(skills.filter((s) => s.install && s.install.scope === 'project').map((s) => s.install.package)),
                    },
                    onInstalled: () => load(cwd),
                  })
                : selectedSkill
                  ? h(Detail, {
                      skill: selectedSkill,
                      cwd,
                      toggling: toggling.has(selectedSkill.filePath),
                      saveError,
                      updateStatus: updateKey(selectedSkill) ? statuses[updateKey(selectedSkill)] : undefined,
                      checkingUpdate: updateKey(selectedSkill) ? checking.has(updateKey(selectedSkill)) : false,
                      updating: updatingKey === updateKey(selectedSkill),
                      updateError,
                      onToggle: toggle,
                      onCheckUpdate: () => checkForUpdates(selectedSkill),
                      onUpdate: () => updateOne(selectedSkill),
                    })
                  : h('div', { style: { height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: V.muted, fontSize: 13 } }, loading ? '' : '选择一个技能'))),
          /* Footer */
          h('div', { style: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 18px', borderTop: '1px solid ' + V.border, flexShrink: 0 } },
            h('div', { style: { display: 'flex', alignItems: 'center', gap: 10 } },
              skills.some((s) => s.install) ? h('button', {
                onClick: () => checkForUpdates(),
                disabled: checkingAll || updatingKey !== null,
                style: { padding: '6px 12px', background: 'none', border: '1px solid ' + V.border, borderRadius: 6, color: V.muted, cursor: checkingAll || updatingKey !== null ? 'not-allowed' : 'pointer', opacity: checkingAll || updatingKey !== null ? 0.5 : 1, fontSize: 12 },
              }, checkingAll ? '检查中…' : '检查更新') : null,
              Object.values(statuses).filter((st) => st.state === 'update-available').length > 0
                ? h('span', { style: { fontSize: 12, color: V.warn } }, Object.values(statuses).filter((st) => st.state === 'update-available').length + ' 项更新')
                : null),
            h('button', { onClick: () => setOpen(false), style: { padding: '6px 14px', background: 'none', border: '1px solid ' + V.border, borderRadius: 6, color: V.muted, cursor: 'pointer', fontSize: 13 } }, '关闭'))))
    }


    function applySkillsUI(ctx) {
      ctx.provide('dshSkillsUI')
      ctx.dshSkillsUI = {
        open(cwd) { skillsUI.open(cwd) },
        close() { skillsUI.close() },
      }
      ctx.slots.inject('shell.overlay', () =>
        ctx.slots.register({ name: 'shell.overlay', id: 'dsh-geek-sidebar-skills' }, () => h(SkillsModal, null))
      )
    }


    /* ============================ 模块出口 ============================ */
    exports.name = 'dsh-geek-sidebar'
    exports.inject = ['sessions', 'slots']
    exports.apply = function apply(ctx) {
      /* filemention 必须先于 workbench：后者经 fileMentionBridge 惰性取用
       *（ctx.get 在 fiber 启动态拿不到，见 head.js 桥注释） */
      try { applyFilemention(ctx) } catch (e) { console.error('[dsh-geek-sidebar] filemention 挂载失败', e) }
      try { applySkillsUI(ctx) } catch (e) { console.error('[dsh-geek-sidebar] skills 挂载失败', e) }
      try { workbenchMod.apply(ctx) } catch (e) { console.error('[dsh-geek-sidebar] workbench 挂载失败', e) }
    }

    return module.exports
  },
})
