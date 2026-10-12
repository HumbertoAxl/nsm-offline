//NAME(PL_VCOL_SCROLLFRAG)
//IOS
precision highp float;
//END
//ANDROID
precision mediump float;
//END

uniform sampler2D TexSamp0;
uniform sampler2D TexSamp1;
varying mediump vec2 texcoord1;
varying mediump vec2 texcoord2;
varying lowp vec4 color;
uniform float Time;

//DEPTHTEST=ON
//DEPTHWRITE=ON
//CULLFACE=ON

void main(){
	gl_FragColor = texture2D(TexSamp0,vec2(texcoord1.x,texcoord1.y+Time))*(color*texture2D(TexSamp1,texcoord2.xy));
}
