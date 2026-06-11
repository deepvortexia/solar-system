import bpy
import bmesh
import math
import numpy as np
import sshelp as H

SAT_X = 36.0
SAT_R = 2.7


def col(nt):
    return H.band_color(nt, [
        (0.00, '#B89D6F'),
        (0.15, '#CBB585'),
        (0.30, '#E3D2A8'),
        (0.45, '#D6C094'),
        (0.58, '#E8DAB4'),
        (0.72, '#C9B07E'),
        (0.86, '#DECDA0'),
        (1.00, '#BCA274'),
    ], noise_scale=4.0, distort=0.03, detail=5.0)


saturn = H.build_planet("Saturn", SAT_R, SAT_X, col, img_size=1024,
                        roughness=0.65, tilt=26.7, seg=96, rings=48)

# ---- rings: flat annulus with radial UVs ----
R_IN, R_OUT = 1.24 * SAT_R, 2.30 * SAT_R
SEG = 256
mesh = bpy.data.meshes.new("SaturnRingsMesh")
bm = bmesh.new()
inner, outer = [], []
for i in range(SEG):
    a = 2.0 * math.pi * i / SEG
    inner.append(bm.verts.new((R_IN * math.cos(a), R_IN * math.sin(a), 0.0)))
    outer.append(bm.verts.new((R_OUT * math.cos(a), R_OUT * math.sin(a), 0.0)))
faces = []
for i in range(SEG):
    j = (i + 1) % SEG
    faces.append(bm.faces.new((inner[i], outer[i], outer[j], inner[j])))
uv_layer = bm.loops.layers.uv.new("UVMap")
for face in faces:
    vs = []
    for loop in face.loops:
        co = loop.vert.co
        r = (co.length - R_IN) / (R_OUT - R_IN)
        ang = math.atan2(co.y, co.x) % (2.0 * math.pi)
        vs.append((loop, r, ang / (2.0 * math.pi)))
    # fix seam wrap: if angles span > half turn, shift small ones up
    angs = [v for (_, _, v) in vs]
    if max(angs) - min(angs) > 0.5:
        vs = [(l, r, v + 1.0 if v < 0.5 else v) for (l, r, v) in vs]
    for loop, r, v in vs:
        loop[uv_layer].uv = (r, v)
bm.to_mesh(mesh)
bm.free()
rings = bpy.data.objects.new("SaturnRings", mesh)
bpy.context.collection.objects.link(rings)
rings.location = (SAT_X, 0.0, 0.0)
rings.parent = saturn
rings.matrix_parent_inverse = saturn.matrix_world.inverted()

# ---- ring material: bake color then alpha, merge into one RGBA image ----
mat = H.new_mat(rings, "SaturnRingsMat")
nt = mat.node_tree

tc = H.tex_coord(nt)
sep = nt.nodes.new('ShaderNodeSeparateXYZ')
nt.links.new(tc.outputs['UV'], sep.inputs[0])

# fine striations along the radius
noi = nt.nodes.new('ShaderNodeTexNoise')
noi.inputs['Scale'].default_value = 90.0
noi.inputs['Detail'].default_value = 2.0
vm = nt.nodes.new('ShaderNodeVectorMath')
vm.operation = 'MULTIPLY'
nt.links.new(tc.outputs['UV'], vm.inputs[0])
vm.inputs[1].default_value = (1.0, 0.0, 0.0)
nt.links.new(vm.outputs['Vector'], noi.inputs['Vector'])
striate = H.ramp(nt, [(0.0, 0.78), (1.0, 1.0)])
nt.links.new(noi.outputs['Fac'], striate.inputs['Fac'])

col_ramp = H.ramp(nt, [
    (0.00, '#5E5142'),
    (0.10, '#8A7758'),
    (0.27, '#9C8765'),
    (0.31, '#CDB68B'),
    (0.50, '#D9C49A'),
    (0.66, '#C3AC80'),
    (0.70, '#4A4036'),
    (0.76, '#3F372E'),
    (0.80, '#B49E76'),
    (0.93, '#A9956E'),
    (1.00, '#6B5C49'),
])
nt.links.new(sep.outputs['X'], col_ramp.inputs['Fac'])
ring_color = H.mix_color(nt, 1.0, col_ramp.outputs['Color'],
                         striate.outputs['Color'], blend='MULTIPLY')

alpha_ramp = H.ramp(nt, [
    (0.00, 0.05),
    (0.06, 0.40),
    (0.28, 0.55),
    (0.32, 0.95),
    (0.65, 0.90),
    (0.70, 0.15),
    (0.77, 0.12),
    (0.81, 0.80),
    (0.95, 0.55),
    (1.00, 0.00),
])
nt.links.new(sep.outputs['X'], alpha_ramp.inputs['Fac'])

em = H.connect_emission(nt, ring_color)

img_color = bpy.data.images.new("SaturnRingsTex", 1024, 1024)
H.bake_emit(rings, mat, img_color)

# rewire emission to the alpha pattern and bake into a non-color image
nt.links.new(alpha_ramp.outputs['Color'], em.inputs['Color'])
img_alpha = bpy.data.images.new("SaturnRingsAlpha", 1024, 1024)
img_alpha.colorspace_settings.name = 'Non-Color'
H.bake_emit(rings, mat, img_alpha)

# merge: alpha image's R channel -> color image's A channel
w, h = img_color.size
buf = np.empty(w * h * 4, dtype=np.float32)
img_color.pixels.foreach_get(buf)
abuf = np.empty(w * h * 4, dtype=np.float32)
img_alpha.pixels.foreach_get(abuf)
buf[3::4] = abuf[0::4]
img_color.pixels.foreach_set(buf)
img_color.update()
H.try_pack(img_color)
bpy.data.images.remove(img_alpha)

H.finalize_pbr(mat, img_color, roughness=0.85, use_alpha=True)

_result = "Saturn (r=2.7 at x=36, tilt 26.7) + rings (annulus 3.35-6.21, RGBA baked)"
