import sshelp as H


def col(nt):
    # thick creamy sulfuric cloud deck with swirls
    return H.noise_color(nt, [
        (0.00, '#A8854E'),
        (0.35, '#C9A86C'),
        (0.60, '#DEC68F'),
        (0.85, '#EFE3B8'),
        (1.00, '#F7EFD2'),
    ], scale=3.0, detail=8.0, distortion=1.3)


obj = H.build_planet("Venus", 0.95, 12.5, col, img_size=512, roughness=0.8,
                     tilt=177.4)
_result = "Venus created (r=0.95 at x=12.5, retrograde tilt)"
