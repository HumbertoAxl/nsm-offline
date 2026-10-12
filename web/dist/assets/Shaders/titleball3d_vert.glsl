//NAME(TITLEBALLVERT)
attribute vec4 Position;
attribute vec4 Normal;
attribute vec4 TexCoord;
uniform mat4 MVPMatrix;
uniform mat4 MVMatrix;
uniform mat4 MMatrix;
varying vec2 texcoord;
varying vec4 norm;
varying vec4 pos;

uniform vec4 UVTrans0;
uniform vec4 campos;

void main(){
	vec4 posscaled;
	gl_Position=MVPMatrix*Position;
	norm.xyz = (MMatrix*vec4(Normal.xyz,0.0)).xyz;
	norm.w = max(0.0,(MVMatrix *vec4(Normal.xyz,0.0)).z+1.5)*0.35;
	texcoord = (TexCoord.xy * UVTrans0.zw) + UVTrans0.xy;
	pos.xyz = (MMatrix * Position).xyz-campos.xyz;
	pos.w=campos.w;
}
