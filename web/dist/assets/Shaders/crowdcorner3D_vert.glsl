//NAME(CROWDCORNERVERT)
Import:(precision.h)
attribute vec4 Position;
attribute vec4 Normal;
attribute vec4 TexCoord;
attribute vec4 Position2;
uniform mat4 MVPMatrix;
uniform mat4 MMatrix;
varying vec2 texcoord;
varying vec2 texcoord2;
varying mediump vec4 norm;
uniform vec4 UVTrans0;
uniform vec4 UVTrans1;
uniform vec4 corner;

void main(){
	mediump vec4 posscaled;
	mediump vec4 posrot;
	mediump vec4 poscorner;

	poscorner = Position2 - corner; //Y = row, defines length of arc
	float ang = (poscorner.x+100.0) / poscorner.y;
	vec4 cs;
	cs.x = cos(ang);
	cs.y = sin(ang);
	cs.zw = cs.xy*vec2(1,-1);
	poscorner.x = poscorner.y*cs.y;
	poscorner.y = poscorner.y*cs.x;

	posscaled = Position * vec4(532,552,788,1) - vec4(256,256,0,0);

	posrot.x = dot(posscaled.xy,cs.xy);
	posrot.y = dot(posscaled.xy,cs.wz);

	posscaled.xy= posrot.xy;
	posscaled+=poscorner;
	posscaled.w = 1.0;
	gl_Position=MVPMatrix*posscaled;
	posscaled =MMatrix * (posscaled+Normal*vec2(1200.0,0.0).xxxy);
	norm.x = (1.4-Normal.y)*(0.6-Position.z*0.7);
	texcoord.xy = (TexCoord.xy* UVTrans0.zw) + UVTrans0.xy;
	texcoord2.xy =(posscaled.xy*vec2(0.00004,0.000043)+vec2(0.5,0.5));
}
