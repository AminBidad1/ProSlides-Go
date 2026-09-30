package media

import (
	"image"
	"image/color"
	"math"
)

type variantSpec struct {
	name        string
	maxLongEdge int
	suffix      string
}

var imageVariantSpecs = []variantSpec{
	{name: VariantThumbnail, maxLongEdge: 480, suffix: ".thumb"},
	{name: VariantMedium, maxLongEdge: 1280, suffix: ".medium"},
	{name: VariantLarge, maxLongEdge: 2560, suffix: ".large"},
}

func scaledDimensions(width, height, maxLongEdge int) (int, int, bool) {
	if width <= 0 || height <= 0 || maxLongEdge <= 0 {
		return 0, 0, false
	}
	longEdge := max(width, height)
	if longEdge <= maxLongEdge {
		return width, height, false
	}
	scale := float64(maxLongEdge) / float64(longEdge)
	return max(1, int(math.Round(float64(width)*scale))),
		max(1, int(math.Round(float64(height)*scale))),
		true
}

func imageToNRGBA(source image.Image) *image.NRGBA {
	bounds := source.Bounds()
	output := image.NewNRGBA(image.Rect(0, 0, bounds.Dx(), bounds.Dy()))
	for y := 0; y < bounds.Dy(); y++ {
		for x := 0; x < bounds.Dx(); x++ {
			output.SetNRGBA(
				x,
				y,
				color.NRGBAModel.Convert(
					source.At(bounds.Min.X+x, bounds.Min.Y+y),
				).(color.NRGBA),
			)
		}
	}
	return output
}

func resizeBilinear(source *image.NRGBA, width, height int) *image.NRGBA {
	if source.Bounds().Dx() == width && source.Bounds().Dy() == height {
		copyImage := image.NewNRGBA(image.Rect(0, 0, width, height))
		copy(copyImage.Pix, source.Pix)
		return copyImage
	}

	output := image.NewNRGBA(image.Rect(0, 0, width, height))
	sourceWidth := source.Bounds().Dx()
	sourceHeight := source.Bounds().Dy()

	for y := 0; y < height; y++ {
		sourceY := (float64(y)+0.5)*float64(sourceHeight)/float64(height) - 0.5
		y0 := int(math.Floor(sourceY))
		y1 := y0 + 1
		wy := sourceY - float64(y0)
		if y0 < 0 {
			y0 = 0
			wy = 0
		}
		if y1 >= sourceHeight {
			y1 = sourceHeight - 1
		}

		for x := 0; x < width; x++ {
			sourceX := (float64(x)+0.5)*float64(sourceWidth)/float64(width) - 0.5
			x0 := int(math.Floor(sourceX))
			x1 := x0 + 1
			wx := sourceX - float64(x0)
			if x0 < 0 {
				x0 = 0
				wx = 0
			}
			if x1 >= sourceWidth {
				x1 = sourceWidth - 1
			}

			c00 := source.NRGBAAt(x0, y0)
			c10 := source.NRGBAAt(x1, y0)
			c01 := source.NRGBAAt(x0, y1)
			c11 := source.NRGBAAt(x1, y1)

			output.SetNRGBA(x, y, bilinearColor(c00, c10, c01, c11, wx, wy))
		}
	}

	return output
}

func bilinearColor(
	c00, c10, c01, c11 color.NRGBA,
	wx, wy float64,
) color.NRGBA {
	alpha := interpolateChannel(
		float64(c00.A),
		float64(c10.A),
		float64(c01.A),
		float64(c11.A),
		wx,
		wy,
	)
	if alpha <= 0 {
		return color.NRGBA{}
	}

	premultiplied := func(channel, a uint8) float64 {
		return float64(channel) * float64(a) / 255
	}
	unpremultiply := func(value float64) uint8 {
		return clampByte(value * 255 / alpha)
	}

	return color.NRGBA{
		R: unpremultiply(interpolateChannel(
			premultiplied(c00.R, c00.A),
			premultiplied(c10.R, c10.A),
			premultiplied(c01.R, c01.A),
			premultiplied(c11.R, c11.A),
			wx,
			wy,
		)),
		G: unpremultiply(interpolateChannel(
			premultiplied(c00.G, c00.A),
			premultiplied(c10.G, c10.A),
			premultiplied(c01.G, c01.A),
			premultiplied(c11.G, c11.A),
			wx,
			wy,
		)),
		B: unpremultiply(interpolateChannel(
			premultiplied(c00.B, c00.A),
			premultiplied(c10.B, c10.A),
			premultiplied(c01.B, c01.A),
			premultiplied(c11.B, c11.A),
			wx,
			wy,
		)),
		A: clampByte(alpha),
	}
}

func interpolateChannel(
	v00, v10, v01, v11 float64,
	wx, wy float64,
) float64 {
	top := v00 + (v10-v00)*wx
	bottom := v01 + (v11-v01)*wx
	return top + (bottom-top)*wy
}

func clampByte(value float64) uint8 {
	if value <= 0 {
		return 0
	}
	if value >= 255 {
		return 255
	}
	return uint8(math.Round(value))
}
