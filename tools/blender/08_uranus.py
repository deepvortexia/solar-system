import sshelp as H


def col(nt):
    return H.band_color(nt, [
        (0.00, '#7FBEC4'),
        (0.40, '#93CDD2'),
        (0.70, '#A4DADD'),
        (1.00, '#B7E4E6'),
    ], noise_scale=3.0, distort=0.02, detail=4.0)


obj = H.build_planet("Uranus", 1.6, 44.0, col, img_size=512, roughness=0.6,
                     tilt=97.8)
_result = "Uranus created (r=1.6 at x=44, tilt 97.8 - rolls on its side)"
