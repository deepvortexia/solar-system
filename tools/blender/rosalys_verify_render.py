import bpy

sc = bpy.data.scenes.get("Rosalys")
bpy.context.window.scene = sc

# target the camera looks at (mid-body)
tgt = bpy.data.objects.get("RRenderTarget")
if tgt is None:
    bpy.ops.object.empty_add(location=(0, 0, 2.7))
    tgt = bpy.context.active_object
    tgt.name = "RRenderTarget"
tgt.location = (0, 0, 2.7)

# camera in front (-Y)
cam = bpy.data.objects.get("RRenderCam")
if cam is None:
    cd = bpy.data.cameras.new("RRenderCam")
    cam = bpy.data.objects.new("RRenderCam", cd)
    sc.collection.objects.link(cam)
cam.location = (0.0, -9.0, 2.7)  # level, straight-on front view to judge eye direction
con = cam.constraints.new("TRACK_TO") if not cam.constraints else cam.constraints[0]
con.target = tgt
con.track_axis = "TRACK_NEGATIVE_Z"
con.up_axis = "UP_Y"
cam.data.lens = 60
sc.camera = cam

# key + fill lights
for name, loc, energy in (("RKey", (-4, -6, 6), 1400), ("RFill", (5, -4, 3), 600)):
    lo = bpy.data.objects.get(name)
    if lo is None:
        ld = bpy.data.lights.new(name, "AREA")
        lo = bpy.data.objects.new(name, ld)
        sc.collection.objects.link(lo)
    lo.location = loc
    lo.data.energy = energy
    lo.data.size = 5.0

engines = bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items.keys()
sc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in engines else (
    'BLENDER_EEVEE' if 'BLENDER_EEVEE' in engines else sc.render.engine)
sc.render.resolution_x = 640
sc.render.resolution_y = 900
sc.render.film_transparent = False
out = r"C:\Users\Yan\deepvortex-repos\solar-system\tools\blender\rosalys_preview.png"
sc.render.filepath = out
sc.render.image_settings.file_format = 'PNG'
bpy.ops.render.render(write_still=True)

_result = f"rendered ({sc.render.engine}) -> {out}"
