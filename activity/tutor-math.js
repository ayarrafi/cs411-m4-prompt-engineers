/* Render only AI tutor message nodes, never interpret model text as HTML. */
(function(root){
  'use strict';
  root.TutorMath={render(element){
    if(typeof root.renderMathInElement!=='function')return;
    try{
      root.renderMathInElement(element,{
        delimiters:[
          {left:'$$',right:'$$',display:true},
          {left:'\\[',right:'\\]',display:true},
          {left:'\\(',right:'\\)',display:false},
          {left:'$',right:'$',display:false}
        ],
        trust:false,throwOnError:false,strict:'ignore',maxExpand:200,maxSize:10,
        output:'htmlAndMathml'
      });
    }catch{ /* Keep the existing text readable if rendering fails. */ }
  }};
})(globalThis);
