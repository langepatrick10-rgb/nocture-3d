"""Export a concert grand for Piano3D.

Name each playable key mesh Key_21 … Key_108 (MIDI A0–C8).
Put the object origin on the balance rail so the web app can hinge-press it.
Export File → glTF 2.0 (.glb) or run this from Blender:

    blender -b your_grand.blend -P scripts/blender_export_piano.py
"""

from pathlib import Path

import bpy

OUT = Path(__file__).resolve().parents[1] / "public" / "models" / "grand-piano.glb"

bpy.ops.export_scene.gltf(
    filepath=str(OUT),
    export_format="GLB",
    export_apply=False,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_extras=True,
    export_yup=True,
)
print(f"Wrote {OUT}")
