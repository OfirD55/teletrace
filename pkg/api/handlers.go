package api

import (
	"net/http"
	"oss-tracing/pkg/model"
	spansquery "oss-tracing/pkg/model/spansquery/v1"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

func (api *API) getPing(c *gin.Context) {
	c.String(http.StatusOK, "pong")
}

func (api *API) search(c *gin.Context) {
	var req spansquery.SearchRequest
	isValidationError := api.validateRequestBody(&req, c)
	if isValidationError {
		return
	}
	res, err := (*api.spanReader).Search(c, &req)
	if err != nil {
		respondWithError(http.StatusInternalServerError, err, c)
		return
	}
	c.JSON(http.StatusOK, res)
}

func (api *API) getTraceById(c *gin.Context) {
	traceId := c.Param("id")
	sr := &spansquery.SearchRequest{
		Timeframe: spansquery.Timeframe{
			StartTime: 0,
			EndTime:   uint64(time.Now().UnixNano()),
		},
		SearchFilters: []spansquery.SearchFilter{
			{
				KeyValueFilter: &spansquery.KeyValueFilter{
					Key:      "span.traceId",
					Operator: spansquery.OPERATOR_EQUALS,
					Value:    traceId,
				},
			},
		},
	}

	res, err := (*api.spanReader).Search(c, sr)
	if err != nil {
		respondWithError(http.StatusInternalServerError, err, c)
		return
	}

	c.JSON(http.StatusOK, res)
}

func (api *API) getAvailableTags(c *gin.Context) {
	res, err := (*api.spanReader).GetAvailableTags(c, model.GetAvailableTagsRequest{})
	if err != nil {
		respondWithError(http.StatusInternalServerError, err, c)
		return
	}

	c.JSON(http.StatusOK, res)
}

func (api *API) tagsValues(c *gin.Context) {
	var req model.GetTagsValuesRequest
	isValidationError := api.validateRequestBody(&req, c)
	if isValidationError {
		return
	}
	tagsParam := c.Request.URL.Query().Get("tags")
	tags := strings.Split(tagsParam, ",")

	autoPrefixTags := false
	req.AutoPrefixTags = &autoPrefixTags
	req.Tags = tags
	res, err := (*api.spanReader).GetTagsValues(c, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, &gin.H{"message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, res)
}