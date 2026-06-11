import sshelp as H


def col(nt):
    # solar granulation: deep red -> orange -> bright yellow
    return H.noise_color(nt, [
        (0.00, '#9C1A00'),
        (0.35, '#D43D00'),
        (0.55, '#FF7A00'),
        (0.75, '#FFB52E'),
        (1.00, '#FFE08A'),
    ], scale=7.0, detail=8.0, distortion=0.4)


obj = H.build_planet("Sun", 5.0, 0.0, col, img_size=1024, roughness=1.0,
                     seg=96, rings=48, emissive=True, emission_strength=5.0)
_result = f"Sun created (r=5.0, emissive baked 1024px)"
