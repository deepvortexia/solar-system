"""Helper library injected into Blender for building the solar system scene."""
import bpy
import math


def hx(h):
    """Hex color -> linear RGBA tuple (approx sRGB -> linear via 2.2 gamma)."""
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255.0) ** 2.2 for i in (0, 2, 4)) + (1.0,)


def _c(c):
    if isinstance(c, str):
        return hx(c)
    if isinstance(c, (int, float)):
        return (c, c, c, 1.0)
    return c


def make_sphere(name, radius, location, seg=64, rings=32, tilt=0.0):
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=seg, ring_count=rings, radius=radius, location=location)
    obj = bpy.context.active_object
    obj.name = name
    obj.data.name = name + "Mesh"
    bpy.ops.object.shade_smooth()
    if tilt:
        obj.rotation_euler[1] = math.radians(tilt)
    return obj


def new_mat(obj, name):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    obj.data.materials.append(mat)
    return mat


def ramp(nt, stops, interp='LINEAR'):
    cr = nt.nodes.new('ShaderNodeValToRGB')
    cr.color_ramp.interpolation = interp
    els = cr.color_ramp.elements
    els[0].position = stops[0][0]
    els[0].color = _c(stops[0][1])
    els[-1].position = stops[-1][0]
    els[-1].color = _c(stops[-1][1])
    for pos, col in stops[1:-1]:
        e = els.new(pos)
        e.color = _c(col)
    return cr


def tex_coord(nt):
    return nt.nodes.new('ShaderNodeTexCoord')


def math_node(nt, op, a=None, b=None, va=None, vb=None):
    n = nt.nodes.new('ShaderNodeMath')
    n.operation = op
    if a is not None:
        nt.links.new(a, n.inputs[0])
    elif va is not None:
        n.inputs[0].default_value = va
    if b is not None:
        nt.links.new(b, n.inputs[1])
    elif vb is not None:
        n.inputs[1].default_value = vb
    return n


def mix_color(nt, fac, a, b, blend='MIX'):
    """fac/a/b may be sockets or values. Returns the result color socket."""
    n = nt.nodes.new('ShaderNodeMix')
    n.data_type = 'RGBA'
    n.blend_type = blend
    pairs = ((n.inputs[0], fac, False), (n.inputs[6], a, True), (n.inputs[7], b, True))
    for sock, v, is_col in pairs:
        if hasattr(v, 'is_linked'):
            nt.links.new(v, sock)
        else:
            sock.default_value = _c(v) if is_col else v
    return n.outputs[2]


def noise_color(nt, stops, scale=5.0, detail=6.0, distortion=0.0):
    """Noise texture through a color ramp. Returns color socket."""
    tc = tex_coord(nt)
    noi = nt.nodes.new('ShaderNodeTexNoise')
    noi.inputs['Scale'].default_value = scale
    noi.inputs['Detail'].default_value = detail
    noi.inputs['Distortion'].default_value = distortion
    nt.links.new(tc.outputs['Generated'], noi.inputs['Vector'])
    cr = ramp(nt, stops)
    nt.links.new(noi.outputs['Fac'], cr.inputs['Fac'])
    return cr.outputs['Color']


def band_color(nt, stops, noise_scale=4.0, distort=0.05, detail=4.0):
    """Latitude bands (generated Z) warped by noise, through a color ramp."""
    tc = tex_coord(nt)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    noi = nt.nodes.new('ShaderNodeTexNoise')
    noi.inputs['Scale'].default_value = noise_scale
    noi.inputs['Detail'].default_value = detail
    nt.links.new(tc.outputs['Generated'], noi.inputs['Vector'])
    m1 = math_node(nt, 'SUBTRACT', a=noi.outputs['Fac'], vb=0.5)
    m2 = math_node(nt, 'MULTIPLY', a=m1.outputs[0], vb=distort)
    m3 = math_node(nt, 'ADD', a=sep.outputs['Z'], b=m2.outputs[0])
    cr = ramp(nt, stops)
    nt.links.new(m3.outputs[0], cr.inputs['Fac'])
    return cr.outputs['Color']


def polar_caps(nt, base_color_socket, cap_color='#EAF2F5', start=0.40, end=0.46):
    """Mix white-ish caps over base color near the poles (generated Z)."""
    tc = tex_coord(nt)
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    d = math_node(nt, 'SUBTRACT', a=sep.outputs['Z'], vb=0.5)
    ab = math_node(nt, 'ABSOLUTE', a=d.outputs[0])
    mr = nt.nodes.new('ShaderNodeMapRange')
    mr.interpolation_type = 'SMOOTHSTEP'
    mr.inputs['From Min'].default_value = start
    mr.inputs['From Max'].default_value = end
    nt.links.new(ab.outputs[0], mr.inputs['Value'])
    return mix_color(nt, mr.outputs['Result'], base_color_socket, cap_color)


def connect_emission(nt, color_socket):
    em = nt.nodes.new('ShaderNodeEmission')
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    nt.links.new(color_socket, em.inputs['Color'])
    nt.links.new(em.outputs['Emission'], out.inputs['Surface'])
    return em


def bake_emit(obj, mat, img, samples=1):
    """Bake the material's emission output into img via Cycles."""
    nt = mat.node_tree
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    for n in nt.nodes:
        n.select = False
    tex.select = True
    nt.nodes.active = tex
    scene = bpy.context.scene
    prev = scene.render.engine
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.bake(type='EMIT')
    scene.render.engine = prev
    nt.nodes.remove(tex)
    return img


def finalize_pbr(mat, img, roughness=0.9, metallic=0.0,
                 emissive=False, emission_strength=4.0, use_alpha=False):
    """Replace the node tree with a GLTF-friendly Principled BSDF + baked texture."""
    nt = mat.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    bsdf.inputs['Roughness'].default_value = roughness
    bsdf.inputs['Metallic'].default_value = metallic
    if emissive:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Emission Color'])
        bsdf.inputs['Emission Strength'].default_value = emission_strength
        bsdf.inputs['Base Color'].default_value = (0.0, 0.0, 0.0, 1.0)
    else:
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if use_alpha:
        nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
        if hasattr(mat, 'blend_method'):
            mat.blend_method = 'BLEND'
        if hasattr(mat, 'surface_render_method'):
            mat.surface_render_method = 'BLENDED'
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    return mat


def try_pack(img):
    try:
        img.pack()
    except Exception:
        pass  # exporter reads pixel buffers directly, packing is best-effort


def retexture(name, color_fn, img_size=1024, roughness=0.9,
              emissive=False, emission_strength=4.0):
    """Rebuild the material of an existing object with a fresh bake."""
    obj = bpy.data.objects[name]
    obj.data.materials.clear()
    for m in list(bpy.data.materials):
        if m.name.startswith(name + "Mat"):
            bpy.data.materials.remove(m)
    for i in list(bpy.data.images):
        if i.name.startswith(name + "Tex"):
            bpy.data.images.remove(i)
    mat = new_mat(obj, name + "Mat")
    nt = mat.node_tree
    connect_emission(nt, color_fn(nt))
    img = bpy.data.images.new(name + "Tex", img_size, img_size)
    bake_emit(obj, mat, img)
    try_pack(img)
    finalize_pbr(mat, img, roughness=roughness,
                 emissive=emissive, emission_strength=emission_strength)
    return obj


def build_planet(name, radius, x, color_fn, img_size=512, roughness=0.9,
                 tilt=0.0, seg=64, rings=32, emissive=False, emission_strength=4.0):
    obj = make_sphere(name, radius, (x, 0.0, 0.0), seg, rings, tilt)
    mat = new_mat(obj, name + "Mat")
    nt = mat.node_tree
    color_sock = color_fn(nt)
    connect_emission(nt, color_sock)
    img = bpy.data.images.new(name + "Tex", img_size, img_size)
    bake_emit(obj, mat, img)
    try_pack(img)
    finalize_pbr(mat, img, roughness=roughness,
                 emissive=emissive, emission_strength=emission_strength)
    return obj
