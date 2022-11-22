import _clamp from "lodash-es/clamp";
import _mapValues from "lodash-es/mapValues";
import { Component } from "react";

import ErrorMessage from "./ErrorMessage.js";
import LoadingIndicator from "./LoadingIndicator.js";
// eslint-disable-next-line import/no-cycle
import TracePageHeader from "./TracePageHeader/index.js";
// eslint-disable-next-line import/no-cycle
import TraceTimelineViewer from "./TraceTimelineViewer/index.js";
import { FETCHED_STATE } from "./utils/constants.js";
import {
  merge as mergeShortcuts,
  reset as resetShortcuts,
} from "./utils/keyboard-shortcuts.js";
import {
  cancel as cancelScroll,
  scrollBy,
  scrollTo,
} from "./utils/scroll-page.js";
import ScrollManager from "./utils/ScrollManager.js";

import "u-basscss/css/flexbox.css";
import "u-basscss/css/layout.css";
import "u-basscss/css/margin.css";
import "u-basscss/css/padding.css";
import "u-basscss/css/position.css";
import "./styles.css";

export const VIEW_MIN_RANGE = 0.01;
const VIEW_CHANGE_BASE = 0.005;
const VIEW_CHANGE_FAST = 0.05;

const shortcutConfig = {
  panLeft: [-VIEW_CHANGE_BASE, -VIEW_CHANGE_BASE],
  panLeftFast: [-VIEW_CHANGE_FAST, -VIEW_CHANGE_FAST],
  panRight: [VIEW_CHANGE_BASE, VIEW_CHANGE_BASE],
  panRightFast: [VIEW_CHANGE_FAST, VIEW_CHANGE_FAST],
  zoomIn: [VIEW_CHANGE_BASE, -VIEW_CHANGE_BASE],
  zoomInFast: [VIEW_CHANGE_FAST, -VIEW_CHANGE_FAST],
  zoomOut: [-VIEW_CHANGE_BASE, VIEW_CHANGE_BASE],
  zoomOutFast: [-VIEW_CHANGE_FAST, VIEW_CHANGE_FAST],
};

function makeShortcutCallbacks(adjRange) {
  function getHandler([startChange, endChange]) {
    return function combokeyHandler(event) {
      event.preventDefault();
      adjRange(startChange, endChange);
    };
  }
  return _mapValues(shortcutConfig, getHandler);
}

class TimelineViewer extends Component {
  constructor(props) {
    super(props);

    this.state = {
      headerHeight: null,
      viewRange: {
        time: {
          current: [0, 1],
        },
      },
    };

    this._headerElm = null;

    this.scrollManager = new ScrollManager(undefined, {
      scrollBy,
      scrollTo,
    });
    resetShortcuts();
  }

  componentDidMount() {
    this.updateViewRangeTime(0, 1);

    if (!this.scrollManager) {
      throw new Error("Invalid state - scrollManager is unset");
    }

    const {
      scrollPageDown,
      scrollPageUp,
      scrollToNextVisibleSpan,
      scrollToPrevVisibleSpan,
    } = this.scrollManager;

    const adjViewRange = (a, b) => this.adjustViewRange(a, b, "kbd");
    const shortcutCallbacks = makeShortcutCallbacks(adjViewRange);
    shortcutCallbacks.scrollPageDown = scrollPageDown;
    shortcutCallbacks.scrollPageUp = scrollPageUp;
    shortcutCallbacks.scrollToNextVisibleSpan = scrollToNextVisibleSpan;
    shortcutCallbacks.scrollToPrevVisibleSpan = scrollToPrevVisibleSpan;
    mergeShortcuts(shortcutCallbacks);
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    if (this.scrollManager) {
      this.scrollManager.setTrace(nextProps.trace);
    }
  }

  componentDidUpdate(prevProps) {
    const { activeSpan } = this.props;
    this.setHeaderHeight(this._headerElm);
    if (prevProps.activeSpan !== activeSpan) {
      this.updateViewRangeTime(0, 1);
    }
  }

  componentWillUnmount() {
    resetShortcuts();
    cancelScroll();
    if (this.scrollManager) {
      this.scrollManager.destroy();
      this.scrollManager = new ScrollManager(undefined, {
        scrollBy,
        scrollTo,
      });
    }
  }

  setHeaderHeight = (elm) => {
    const { headerHeight } = this.state;
    this._headerElm = elm;

    if (elm) {
      if (headerHeight !== elm.clientHeight) {
        this.setState({ headerHeight: elm.clientHeight });
      }
    } else if (headerHeight) {
      this.setState({ headerHeight: null });
    }
  };

  updateViewRangeTime = (start, end) => {
    const current = [start, end];
    const time = { current };
    this.setState((state) => ({ viewRange: { ...state.viewRange, time } }));
  };

  updateNextViewRangeTime = (update) => {
    this.setState((state) => {
      const time = { ...state.viewRange.time, ...update };
      return { viewRange: { ...state.viewRange, time } };
    });
  };

  adjustViewRange(startChange, endChange) {
    const { viewRange } = this.state;
    const { time } = viewRange;
    const { current } = time;
    const [viewStart, viewEnd] = current;
    let start = _clamp(viewStart + startChange, 0, 0.99);
    let end = _clamp(viewEnd + endChange, 0.01, 1);
    if (end - start < VIEW_MIN_RANGE) {
      if (startChange < 0 && endChange < 0) {
        end = start + VIEW_MIN_RANGE;
      } else if (startChange > 0 && endChange > 0) {
        end = start + VIEW_MIN_RANGE;
      } else {
        const center = viewStart + (viewEnd - viewStart) / 2;
        start = center - VIEW_MIN_RANGE / 2;
        end = center + VIEW_MIN_RANGE / 2;
      }
    }
    this.updateViewRangeTime(start, end);
  }

  render() {
    const {
      trace,
      removeHoverIndentGuideId,
      setTrace,
      removeJumpToSpan,
      detailToggle,
      childrenToggle,
      setColumnWidth,
      traceState,
      addHoverIndentGuideId,
      setActiveTimelineState,
      activeSpan,
    } = this.props;
    const { viewRange, headerHeight } = this.state;

    if (!trace || trace.state === FETCHED_STATE.LOADING) {
      return <LoadingIndicator className="u-mt-vast" centered />;
    }

    const { data } = trace;
    if (trace.state === FETCHED_STATE.ERROR || !data) {
      return (
        <ErrorMessage
          className="ub-m3"
          error={trace.error || "Unknown error"}
        />
      );
    }

    const headerProps = {
      nextResult: this.scrollManager.scrollToNextVisibleSpan,
      prevResult: this.scrollManager.scrollToPrevVisibleSpan,
      trace: data,
      updateNextViewRangeTime: this.updateNextViewRangeTime,
      updateViewRangeTime: this.updateViewRangeTime,
      viewRange,
    };

    return (
      <div style={{ position: "relative" }}>
        <div className="Tracepage--headerSection" ref={this.setHeaderHeight}>
          <TracePageHeader {...headerProps} />
        </div>

        {headerHeight && (
          <section style={{ overflow: "hidden", paddingTop: headerHeight }}>
            <TraceTimelineViewer
              setColumnWidth={setColumnWidth}
              traceState={traceState}
              registerAccessors={this.scrollManager.setAccessors}
              trace={data}
              updateNextViewRangeTime={this.updateNextViewRangeTime}
              updateViewRangeTime={this.updateViewRangeTime}
              viewRange={viewRange}
              removeHoverIndentGuideId={removeHoverIndentGuideId}
              setTrace={setTrace}
              removeJumpToSpan={removeJumpToSpan}
              detailToggle={detailToggle}
              childrenToggle={childrenToggle}
              addHoverIndentGuideId={addHoverIndentGuideId}
              setActiveTimelineState={setActiveTimelineState}
              activeSpan={activeSpan}
            />
          </section>
        )}
      </div>
    );
  }
}

export default TimelineViewer;