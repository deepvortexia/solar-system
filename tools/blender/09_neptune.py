import sshelp as H


def col(nt):
    return H.band_color(nt, [
        (0.00, '#1B3A8F'),
        (0.30, '#2450B4'),
        (0.48, '#2F62CE'),
        (0.60, '#1E3D9C'),
        (0.78, '#3D6FD6'),
        (1.00, '#4F7BE0'),
    ], noise_scale=4.0, distort=0.05, detail=6.0)


obj = H.build_planet("Neptune", 1.55, 50.0, col, img_size=512, roughness=0.6,
                     tilt=28.3)
_result = "Neptune created (r=1.55 at x=50, tilt 28.3)"
