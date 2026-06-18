import bpy
import math
import mathutils
import sshelp as H

hx = H.hx
sc = bpy.context.scene
R = math.radians

# ---------------------------------------------------------------- materials
# Name-cached Principled BSDF, mirroring mascot_02_geo.py's mat()/paint().
def mat(name, col, rough=0.5, metal=0.0, emit=None, estr=0.6, alpha=1.0):
    m = bpy.data.materials.get(name)
    if m is not None:
        return m
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    c = hx(col)
    b.inputs["Base Color"].default_value = (c[0], c[1], c[2], alpha)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    if alpha < 1.0:
        b.inputs["Alpha"].default_value = alpha
        if hasattr(m, "blend_method"):
            m.blend_method = 'BLEND'
        if hasattr(m, "surface_render_method"):
            m.surface_render_method = 'BLENDED'
        m.use_backface_culling = False  # double-sided wings
    # Always self-illuminate a little: when no emit is given it defaults to the
    # base colour so every surface stays visible from any angle without relying
    # on scene lights (FIX 2). Callers wanting a brighter/explicit glow still
    # pass emit + estr (wings, rose, bracelets, sparkles, etc.).
    if emit is None:
        emit = col
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
        mm = o.modifiers.new("Bevel", "BEVEL")
        mm.width = bevel
        mm.segments = 2
    bpy.ops.object.shade_smooth()
    return o

def parent_keep(children, parent):
    bpy.ops.object.select_all(action="DESELECT")
    for c in children:
        c.select_set(True)
    parent.select_set(True)
    bpy.context.view_layer.objects.active = parent
    bpy.ops.object.parent_set(type="OBJECT", keep_transform=True)

# ---------------------------------------------------------------- palette
SKIN   = ("Skin",   "#F4CDAE")
HAIR   = ("Hair",   "#E7C24E")   # golden-blonde
HAIR2  = ("HairLit","#F6E08A")
BODICE = ("Bodice", "#E24FA0")   # rose-pink gown top
GOWN   = ("Gown",   "#B95AD0")   # rose-violet skirt
ROSEC  = "#CC1111"               # vivid red rose (emissive)
BRA    = "#FF6FD0"               # pink-violet bracelet glow
SPK    = "#FFE3F6"              # sparkle

# front of the character faces -Y (matching Terra)

# ============================================================ HEAD + NECK
head = sphere("Head", 0.62, (0, 0, 3.40), scale=(0.96, 1.0, 1.05))
paint(head, mat(*SKIN, rough=0.45))
neck = sphere("Neck", 0.18, (0, 0.02, 2.92), scale=(1.0, 1.0, 1.3))
paint(neck, mat(*SKIN, rough=0.45))

# ============================================================ FACE (large, expressive blue eyes)
# Layered front-to-back along -Y: tall doe-eye sclera, a vivid BLUE iris ring that
# clearly pokes in front of the white, a dark pupil, then a mirrored catchlight.
for s in (-1, 1):
    tag = "L" if s < 0 else "R"
    # iris/pupil/glint share the eye-white's |x| (0.27) so both eyes look straight
    # forward (concentric), not wall-eyed; only the front-to-back depth (y) is stacked.
    # Smaller, much flatter discs pushed deeper into the head so they read as eyes
    # painted on the face rather than orbits/glasses sticking out.
    white = sphere(f"Eye{tag}", 0.20, (0.27 * s, -0.30, 3.42), scale=(1.0, 0.28, 1.32))
    paint(white, mat("EyeWhite", "#FFFFFF", rough=0.2))
    iris = sphere(f"Iris{tag}", 0.175, (0.27 * s, -0.50, 3.40), scale=(1.0, 0.82 * 0.28, 1.05))
    paint(iris, mat("Iris", "#2E86F0", rough=0.25, emit="#2E86F0", estr=0.6))  # vivid blue
    pupil = sphere(f"Pupil{tag}", 0.085, (0.27 * s, -0.59, 3.39), scale=(1.0, 0.85 * 0.28, 1.05))
    paint(pupil, mat("Pupil", "#12131A", rough=0.2))
    # catchlight: concentric in x, raised in z for a natural upper highlight
    glint = sphere(f"Glint{tag}", 0.05, (0.27 * s, -0.64, 3.50), scale=(1.0, 0.28, 1.0))
    paint(glint, mat("Glint", "#FFFFFF", rough=0.1, emit="#FFFFFF", estr=1.6))
    # flat anime-style eye outline ring laid into the face plane (faces -Y) and
    # flattened in Y so it reads as a crisp dark lash-line around the smaller sclera
    outline = torus(f"EyeLine{tag}", 0.20, 0.03, (0.27 * s, -0.44, 3.42), rot=(R(90), 0, 0))
    outline.scale = (1.0, 0.15, 1.0)
    paint(outline, mat("EyeLine", "#0A0A10", rough=0.3, emit="#0A0A10", estr=0.8))

# soft skin-toned nose bridge between/below the eyes (subtle, slim — not bulbous)
nose = sphere("Nose", 0.05, (0, -0.55, 3.20), scale=(0.8, 0.8, 1.7))
paint(nose, mat(*SKIN, rough=0.45))

# smile: a more pronounced beveled bezier arc -> mesh (Terra's technique), wider and
# deeper so it reads clearly at idle-companion distance
cu = bpy.data.curves.new("RSmileCurve", "CURVE")
cu.dimensions = "3D"
cu.bevel_depth = 0.034
cu.resolution_u = 16
spl = cu.splines.new("BEZIER")
spl.bezier_points.add(2)
pts = [(-0.23, -0.55, 3.10), (0.0, -0.63, 2.97), (0.23, -0.55, 3.10)]
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
paint(smile, mat("Mouth", "#C8607E", rough=0.4))

# ============================================================ HAIR (high-bun style)
# small cap as a base on the crown, a prominent chignon on top, gold cross-pins,
# face-framing bangs, and a few wispy loose back strands.
cap = sphere("HairCap", 0.55, (0, 0.10, 3.52), scale=(1.02, 1.05, 0.95))
paint(cap, mat(*HAIR, rough=0.35, emit=HAIR[1], estr=0.6))
# the chignon: a prominent bun sitting high on top of the head
bun = sphere("HairBun", 0.38, (0, 0, 3.95), scale=(1.0, 0.85, 0.82))
paint(bun, mat(*HAIR, rough=0.35, emit=HAIR[1], estr=0.6))
# two gold decorative pins crossing through the front of the bun (kanzashi-style)
for k, ang in enumerate((20, -20)):
    pin = cone(f"HairPin{k}", 0.022, 0.022, 0.9, (0, -0.28, 3.95), rot=(0, R(90 + ang), 0))
    paint(pin, mat("HairPin", "#FFD700", rough=0.3, emit="#FFD700", estr=0.5))
# bangs: a couple of short tapered fringe shapes over the forehead
for s in (-1, 1):
    bang = cone(f"Bang{s}", 0.22, 0.04, 0.55, (0.26 * s, -0.45, 3.62), rot=(R(s * 8), 0, 0))
    paint(bang, mat(*HAIR, rough=0.35))
# wispy loose back strands (the bun is now the main hair feature, so these are short)
lock_specs = [
    (-0.18, 0.30, 2.55, R(172), R(-10), 2.0),   # left side strand
    ( 0.18, 0.30, 2.55, R(172), R( 10), 2.0),   # right side strand
    (-0.18, 0.55, 2.45, R(172), 0,      2.0),   # back-left strand
    ( 0.18, 0.55, 2.45, R(172), 0,      2.0),   # back-right strand
    ( 0.00, 0.62, 2.40, R(172), 0,      2.0),   # centre-back strand
]
for i, (x, y, z, rx, ry, length) in enumerate(lock_specs):
    lk = cone(f"Lock{i}", 0.20, 0.05, length, (x, y, z), rot=(rx, ry, 0))
    paint(lk, mat(*HAIR, rough=0.35))

# ============================================================ BODY (slender torso + waist)
torso = sphere("Torso", 0.40, (0, 0, 2.45), scale=(1.05, 0.78, 1.25))
paint(torso, mat(*BODICE, rough=0.4))
waist = sphere("Waist", 0.28, (0, 0, 2.02), scale=(1.0, 0.8, 0.9))
paint(waist, mat(*BODICE, rough=0.4))

# ============================================================ GOWN (A-line skirt cone)
# radius1 (bottom/hem) wide, radius2 (top/waist) narrow -> A-line
gown = cone("Gown", 1.35, 0.34, 1.95, (0, 0, 1.05))
paint(gown, mat(*GOWN, rough=0.45))
# gown trim at the hem
hem = torus("GownHem", 1.34, 0.05, (0, 0, 0.10))
paint(hem, mat("GownTrim", "#F0A8E0", rough=0.3, emit="#F0A8E0", estr=0.3))

# sparkle / constellation specks scattered across the gown surface
spark_pts = [
    (-0.55, -0.85, 0.85), (0.40, -1.00, 0.55), (0.70, -0.70, 1.05),
    (-0.30, -1.05, 0.40), (0.10, -0.95, 1.25), (-0.75, -0.70, 0.60),
    (0.55, -0.90, 0.30),
]
for i, (x, y, z) in enumerate(spark_pts):
    sp = sphere(f"Sparkle{i}", 0.035, (x, y, z))
    paint(sp, mat("Sparkle", SPK, rough=0.1, emit="#FFFFFF", estr=2.5))

# ============================================================ ARMS + HANDS + BRACELETS
for s in (-1, 1):
    sh = sphere(f"Shoulder{s}", 0.17, (0.40 * s, 0, 2.58))
    paint(sh, mat(*SKIN, rough=0.45))
    arm = sphere(f"Arm{s}", 0.135, (0.50 * s, -0.05, 2.10), scale=(1.0, 1.0, 3.0))
    arm.rotation_euler = (0, R(s * 10), 0)
    paint(arm, mat(*SKIN, rough=0.45))
    hand = sphere(f"Hand{s}", 0.13, (0.55 * s, -0.18, 1.62))
    paint(hand, mat(*SKIN, rough=0.45))
    # glowing pink-violet energy bracelet at each wrist
    bracelet = torus(f"Bracelet{s}", 0.17, 0.045, (0.55 * s, -0.12, 1.78), rot=(R(90), 0, 0))
    paint(bracelet, mat("Bracelet", BRA, rough=0.2, emit=BRA, estr=5.0))

# ============================================================ ROSE-WAND (held in right hand)
# A clear magic-wand silhouette: a slender handle rising from her right hand (at
# ~(0.55,-0.18,1.62)) up and outward, topped with a glowing hot-pink rose blossom
# that extends well above the hand so it's unmistakable at a glance.
def rod(name, p0, p1, radius, material):
    p0 = mathutils.Vector(p0); p1 = mathutils.Vector(p1)
    d = p1 - p0
    mid = (p0 + p1) / 2
    o = cone(name, radius, radius, d.length, (mid.x, mid.y, mid.z))
    o.rotation_euler = mathutils.Vector((0, 0, 1)).rotation_difference(d.normalized()).to_euler()
    paint(o, material)
    return o

HAND_TIP = (0.56, -0.24, 1.66)     # just past the right hand
BLOSSOM = (0.74, -0.54, 2.82)      # up + outward from the hand
# slender handle from hand to just below the blossom
rod("WandHandle", HAND_TIP, (BLOSSOM[0] - 0.02, BLOSSOM[1] + 0.04, BLOSSOM[2] - 0.18),
    0.035, mat("WandHandle", "#EAD9A0", rough=0.4, emit="#EAD9A0", estr=0.3))
# vivid-red rose: a tight triangular cluster of three petal spheres on a green
# stem, so it reads as an actual rose rather than a pale shapeless blob
rose_mat = mat("Rose", ROSEC, rough=0.3, emit=ROSEC, estr=2.0)
for i in range(3):
    a = R(90 + 120 * i)
    px = BLOSSOM[0] + math.cos(a) * 0.06
    pz = BLOSSOM[2] + math.sin(a) * 0.06
    petal = sphere(f"RosePetal{i}", 0.07, (px, BLOSSOM[1], pz))
    paint(petal, rose_mat)
# thin green stem cone joining the blossom down toward the handle
stem = cone("RoseStem", 0.03, 0.01, 0.25, (BLOSSOM[0] - 0.02, BLOSSOM[1] + 0.04, BLOSSOM[2] - 0.18))
paint(stem, mat("RoseStem", "#22AA22", rough=0.4, emit="#22AA22", estr=0.4))

# ============================================================ WINGS (two-tone translucent dragonfly)
# One flap-pivot empty per side; each carries two lens lobes + radiating veins.
WING_L = ("#FF6FD0", "#FFC2EC")   # rose-pink / violet : petal veins
WING_R = ("#5A5CE0", "#A8AEFF")   # deep blue / violet : star-point veins

def rib(name, lens_loc, lens_eul, length, yaw, color):
    base = mathutils.Euler(lens_eul, "XYZ").to_matrix()
    extra = mathutils.Matrix.Rotation(yaw, 3, "Y")
    rot = (base @ extra).to_euler()
    o = box(name, (length, 0.038, 0.038), lens_loc, rot=(rot.x, rot.y, rot.z))
    paint(o, mat(name + "Mat", color, rough=0.2, emit=color, estr=4.0))
    return o

wing_pivots = []
for s in (-1, 1):
    side = "L" if s < 0 else "R"
    wcol, vcol = WING_L if s < 0 else WING_R
    # a fuller vein fan than before: petal-style (left) vs star-points (right)
    fan = (R(-20), R(-7), R(7), R(20)) if s < 0 else (R(-26), R(-13), 0.0, R(13), R(26))
    bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0.33, 2.60))
    pivot = bpy.context.active_object
    pivot.name = f"Wing{side}"
    parts = []
    # taller, slimmer lobes tilted further upward for a graceful dragonfly sweep
    lobes = [
        (f"Wing{side}Up",  (s * 1.15, 0.34, 3.10), (0, R(s * -28), R(s * -12)), (1.70, 0.05, 0.72)),
        (f"Wing{side}Lo",  (s * 1.00, 0.34, 2.30), (0, R(s * -6),  R(s * -8)),  (1.45, 0.05, 0.62)),
    ]
    for lname, loc, rot, scl in lobes:
        lens = sphere(lname, 1.0, loc, scale=scl, seg=24, rings=12)
        lens.rotation_euler = rot
        paint(lens, mat(f"{lname}Mat", wcol, rough=0.15, emit=wcol, estr=1.2, alpha=0.5))
        parts.append(lens)
        for j, y in enumerate(fan):
            parts.append(rib(f"{lname}Vein{j}", loc, rot, scl[0] * 0.88, y, vcol))
    parent_keep(parts, pivot)
    wing_pivots.append(pivot.name)

# ============================================================ PARENT TO ROOT
bpy.ops.object.empty_add(type="PLAIN_AXES", location=(0, 0, 0))
root = bpy.context.active_object
root.name = "Rosalys"
for o in list(sc.collection.objects):
    if o is not root and o.parent is None:
        o.parent = root

_result = f"Rosalys geometry done. objects={len(sc.collection.objects)}; wings={wing_pivots}"
