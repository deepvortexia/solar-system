import bpy
objs = []
for o in bpy.data.objects:
    parent = o.parent.name if o.parent else "-"
    mats = [m.name for m in o.data.materials] if o.data else []
    objs.append(f"{o.name}(parent={parent}, mats={mats})")
imgs = [f"{i.name}:{i.size[0]}x{i.size[1]}" for i in bpy.data.images if i.name != 'Render Result']
_result = " | ".join(objs) + " || IMAGES: " + ", ".join(imgs)
