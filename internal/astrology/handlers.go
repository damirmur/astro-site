package astrology

import (
	"os"

	"astro-site/internal/astrology/controllers"
	"astro-site/internal/astrology/models"
	"astro-site/internal/astrology/swissephe"

	"github.com/pocketbase/pocketbase/apis"
	"github.com/pocketbase/pocketbase/core"
)

func RegisterAstrologyRoutes(se *core.ServeEvent, defaultSettings swissephe.UserSettings, aiFallback models.AiConfig) {

	se.Router.POST("/api/auth", func(re *core.RequestEvent) error {
		return controllers.HandleAuth(re)
	})

	se.Router.GET("/api/astrology/settings", func(re *core.RequestEvent) error {
		return controllers.HandleGetSettings(re, defaultSettings)
	})

	se.Router.POST("/api/astrology/settings", controllers.HandleSaveSettings)

	se.Router.GET("/api/astrology/chart", func(re *core.RequestEvent) error {
		return controllers.HandleComputeNatal(re, defaultSettings)
	})

	se.Router.GET("/api/astrology/transit", func(re *core.RequestEvent) error {
		return controllers.HandleComputeTransit(re, defaultSettings)
	})

	se.Router.POST("/api/astrology/interpret", func(re *core.RequestEvent) error {
		return controllers.HandleAiInterpretation(re, defaultSettings, aiFallback)
	})

	se.Router.GET("/{path...}", apis.Static(os.DirFS("./pb_public"), true))
}
