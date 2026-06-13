import bpy
import math
import sshelp as H

hx = H.hx
sc = bpy.context.scene

# ---------------------------------------------------------------- materials
# Cached by name: same name -> shared material (keeps the glTF tidy).
def mat(name, col, rough=0.5, metal=0.0, emit=None, estr=4.0):
    m = bpy.data.materials.get(name)
    if m is not None:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = hx(col)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if emit:
        b.inputs["Emission Color"].default_value = hx(emit)
        b.inputs["Emission Strength"].default_value = estr
    return m

def paint(obj, m):
    obj.data.materials.clear()
    obj.data.materials.append(m)
    return obj

# ---------------------------------------------------------------- primitives
def sphere(name, r, loc, scale=(1, 1, 1), seg=32, rings=16):
    o = H.make_sphere(name, r, loc, seg, rings)
    o.scale = scale
    return o

def cone(name, r1, r2, depth, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(radius1=r1, radius2=r2, depth=depth, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.shade_smooth()
    return o

def torus(name, major, minor, loc, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.rotation_euler = rot
    bpy.ops.object.shade_smooth()
    return o

def box(name, scale, loc, rot=(0, 0, 0), bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object
    o.name = name
    o.scale = scale
    o.rotation_euler = rot
    if bevel:
        m = o.modifiers.new("Bevel", "BEVEL")
        m.width = bevel
        m.segments = 2
    bpy.ops.object.shade_smooth()
    return o

R = math.radians
SUIT = "Suit"
ACCENT = "Accent"
CYAN = "Cyan"

# front of the character faces -Y

# ============================================================ FACE
for s in (-1, 1):
    tag = "L" if s < 0 else "R"
    white = sphere(f"Eye{tag}", 0.30, (0.36 * s, -0.80, 2.78), scale=(1.0, 0.85, 1.15))
    paint(white, mat("EyeWhite", "#FFFFFF", rough=0.2))
    pupil = sphere(f"Pupil{tag}", 0.155, (0.40 * s, -1.00, 2.74), scale=(1.0, 0.7, 1.2))
    paint(pupil, mat("Pupil", "#15171C", rough=0.2))
    glint = sphere(f"Glint{tag}", 0.05, (0.33 * s, -1.10, 2.86))
    paint(glint, mat("Glint", "#FFFFFF", rough=0.1, emit="#FFFFFF", estr=1.5))

# smile (a beveled bezier arc, converted to mesh so it exports)
cu = bpy.data.curves.new("SmileCurve", "CURVE")
cu.dimensions = "3D"
cu.bevel_depth = 0.04
cu.resolution_u = 16
spl = cu.splines.new("BEZIER")
spl.bezier_points.add(2)
pts = [(-0.30, -0.92, 2.42), (0.0, -1.03, 2.30), (0.30, -0.92, 2.42)]
for bp, co in zip(spl.bezier_points, pts):
    bp.co = co
    bp.handle_left_type = "AUTO"
    bp.handle_right_type = "AUTO"
smile = bpy.data.objects.new("Smile", cu)
sc.collection.objects.link(smile)
bpy.ops.object.select_all(action="DESELECT")
smile.select_set(True)
bpy.context.view_layer.objects.active = smile
bpy.ops.object.convert(target="MESH")
smile = bpy.context.active_object
paint(smile, mat("Mouth", "#3A2326", rough=0.4))

# ============================================================ SATURN-RING HALO (tilted 30)
halo = torus("Halo", 0.98, 0.07, (0, 0, 3.95), rot=(R(30), 0, 0))
paint(halo, mat("Halo", "#D9C07A", rough=0.35, metal=0.3, emit="#E9D79A", estr=1.0))
halo2 = torus("HaloInner", 0.80, 0.035, (0, 0, 3.95), rot=(R(30), 0, 0))
paint(halo2, mat("HaloInner", "#C2A35E", rough=0.4, metal=0.3))

# ============================================================ BODY (puffy chibi suit)
torso = sphere("Torso", 0.92, (0, 0, 1.25), scale=(1.0, 0.92, 1.05))
paint(torso, mat(SUIT, "#F2F4F8", rough=0.5))
belly = sphere("Belly", 0.7, (0, 0, 0.72), scale=(1.05, 0.95, 0.9))
paint(belly, mat(SUIT, "#F2F4F8", rough=0.5))
collar = torus("Collar", 0.42, 0.10, (0, 0, 1.97))
paint(collar, mat(ACCENT, "#2C6FB5", rough=0.4))

# ============================================================ ARMS
for s in (-1, 1):
    sh = sphere(f"Shoulder{s}", 0.34, (0.92 * s, 0, 1.5))
    paint(sh, mat(SUIT, "#F2F4F8", rough=0.5))
    joint = torus(f"ArmJoint{s}", 0.30, 0.06, (0.92 * s, 0, 1.5), rot=(0, R(90), 0))
    paint(joint, mat(ACCENT, "#2C6FB5", rough=0.4))
    hand = sphere(f"Hand{s}", 0.27, (1.02 * s, -0.10, 1.02))
    paint(hand, mat(SUIT, "#F2F4F8", rough=0.5))
    cuff = torus(f"Cuff{s}", 0.24, 0.05, (0.98 * s, 0, 1.2), rot=(0, R(90), 0))
    paint(cuff, mat(ACCENT, "#2C6FB5", rough=0.4))

# ============================================================ LEGS
for s in (-1, 1):
    leg = sphere(f"Leg{s}", 0.32, (0.34 * s, 0, 0.45), scale=(1, 1, 1.05))
    paint(leg, mat(SUIT, "#F2F4F8", rough=0.5))
    lj = torus(f"LegJoint{s}", 0.26, 0.05, (0.34 * s, 0, 0.28))
    paint(lj, mat(ACCENT, "#2C6FB5", rough=0.4))

# ============================================================ CHEST PANEL + BUTTONS
panel = box("ChestPanel", (0.36, 0.10, 0.24), (0, -0.80, 1.45), bevel=0.03)
paint(panel, mat("Panel", "#2A2E35", rough=0.5, metal=0.2))
btn_r = sphere("BtnRed", 0.075, (-0.13, -0.90, 1.52), scale=(1, 0.6, 1))
paint(btn_r, mat("BtnRed", "#D23B3B", rough=0.3, emit="#D23B3B", estr=0.7))
btn_b = sphere("BtnBlue", 0.075, (0.13, -0.90, 1.52), scale=(1, 0.6, 1))
paint(btn_b, mat("BtnBlue", "#2B6FE0", rough=0.3, emit="#2B6FE0", estr=0.7))
btn_c = sphere("BtnCyan", 0.055, (0.0, -0.90, 1.37), scale=(1, 0.6, 1))
paint(btn_c, mat(CYAN, "#27D3E6", rough=0.3, emit="#27D3E6", estr=1.0))

# ============================================================ LIFE-SUPPORT PACK (back, +Y)
pack = box("LifePack", (0.62, 0.34, 0.74), (0, 0.78, 1.4), bevel=0.05)
paint(pack, mat("Pack", "#EDEFF3", rough=0.55))
stripe = box("PackStripe", (0.64, 0.04, 0.12), (0, 0.96, 1.55))
paint(stripe, mat(ACCENT, "#2C6FB5", rough=0.4))
for i, zz in enumerate((1.62, 1.46)):
    lt = sphere(f"PackLight{i}", 0.05, (0.20, 0.96, zz))
    paint(lt, mat(CYAN, "#27D3E6", rough=0.2, emit="#27D3E6", estr=3.0))

# ============================================================ ROCKET THRUSTERS + FLAMES
for s in (-1, 1):
    noz = cone(f"Thruster{s}", 0.30, 0.18, 0.5, (0.34 * s, 0, -0.05))
    paint(noz, mat("Metal", "#9AA3AD", rough=0.3, metal=1.0))
    rim = torus(f"NozRim{s}", 0.30, 0.04, (0.34 * s, 0, -0.30))
    paint(rim, mat("Rim", "#3A3F47", rough=0.4, metal=0.6))
    flame = cone(f"Flame{s}", 0.0, 0.26, 0.7, (0.34 * s, 0, -0.65))
    paint(flame, mat("Flame", "#23C9FF", rough=0.1, emit="#23C9FF", estr=6.0))
    core = cone(f"FlameCore{s}", 0.0, 0.14, 0.55, (0.34 * s, 0, -0.58))
    paint(core, mat("FlameCore", "#CFF6FF", rough=0.1, emit="#CFF6FF", estr=10.0))

# ============================================================ PARENT TO ROOT
bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
root = bpy.context.active_object
root.name = "Mascot"
for o in list(sc.collection.objects):
    if o is not root and o.parent is None:
        o.parent = root

_result = f"Geometry done. scene objects = {len(sc.collection.objects)}"
