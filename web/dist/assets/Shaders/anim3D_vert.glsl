//NAME(ANIM3DVERT)
attribute vec4 Position;
attribute vec4 TexCoord;
attribute vec4 Normal;
attribute vec4 Position2;
attribute vec4 Normal2;
uniform mat4 MVPMatrix;
uniform mat4 MVMatrix;
uniform mat4 MMatrix;
uniform vec4 Unpack_Scale;
uniform vec4 Unpack_Offset;
uniform vec4 Unpack_Scale2;
uniform vec4 Unpack_Weights;
varying vec2 texcoord;
varying vec4 norm;


uniform vec4 UVTrans0;
uniform vec4 campos;

void main(){
	vec4 posscaled;
	posscaled = (Position *Unpack_Scale)+(Position2 * Unpack_Scale2) + Unpack_Offset;
	gl_Position=MVPMatrix*posscaled;
	vec3 n = (Normal.xyz*Unpack_Weights.xyy)+(Normal2.xyz*Unpack_Weights.zww);
	norm.xyz = (MMatrix*vec4(n,0.0)).xyz;
	norm.w = max(0.0,(MVMatrix *vec4(n,0.0)).z+1.5)*0.35;
	texcoord = (TexCoord.xy * UVTrans0.zw) + UVTrans0.xy;
}
