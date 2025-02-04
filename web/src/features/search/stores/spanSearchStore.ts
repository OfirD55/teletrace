/**
 * Copyright 2022 Cisco Systems, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import create, { StateCreator } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";

import { Operator, SearchFilter, Sort } from "@/features/search";
import { ONE_HOUR_IN_NS, getCurrentTimestamp } from "@/utils/format";

import { AvailableTag } from "../types/availableTags";

interface LiveSpansSlice {
  liveSpansState: {
    isOn: boolean;
    intervalInMillis: number;
    setIsOn: (isOn: boolean) => void;
  };
}
const createLiveSpansSlice: StateCreator<
  TimeframeSlice & LiveSpansSlice & FiltersSlice & SortSlice,
  [],
  [],
  LiveSpansSlice
> = (set) => ({
  liveSpansState: {
    isOn: false,
    intervalInMillis: 2000,
    setIsOn: (isOn: boolean) =>
      set((state) => ({
        liveSpansState: {
          ...state.liveSpansState,
          isOn: isOn,
        },
      })),
  },
});

export type TimeFrameState = {
  startTimeUnixNanoSec: number;
  endTimeUnixNanoSec: number;
  isRelative: boolean;
};

interface TimeframeSlice {
  timeframeState: {
    currentTimeframe: TimeFrameState;
    setRelativeTimeframe: (newStartTimeUnixNanoSec: number) => void;
    setAbsoluteTimeframe: (
      newStartTimeUnixNanoSec: number,
      newEndTimeUnixNanoSec: number
    ) => void;
  };
}
const createTimeframeSlice: StateCreator<
  LiveSpansSlice & TimeframeSlice & FiltersSlice & SortSlice,
  [],
  [],
  TimeframeSlice
> = (set) => ({
  timeframeState: {
    currentTimeframe: {
      startTimeUnixNanoSec: getCurrentTimestamp() - ONE_HOUR_IN_NS,
      endTimeUnixNanoSec: getCurrentTimestamp(),
      isRelative: true,
    },
    setRelativeTimeframe: (newStartTimeUnixNanoSec: number) => {
      set((state) => ({
        timeframeState: {
          ...state.timeframeState,
          currentTimeframe: {
            startTimeUnixNanoSec: newStartTimeUnixNanoSec,
            endTimeUnixNanoSec: state.liveSpansState.isOn
              ? 0 // When endTimeUnixNanoSec is 0, the backend handles the end of the timeframe (optimization for Live Spans feature)
              : getCurrentTimestamp(),
            isRelative: true,
          },
        },
      }));
    },
    setAbsoluteTimeframe: (
      newStartTimeUnixNanoSec: number,
      newEndTimeUnixNanoSec: number
    ) => {
      set((state) => {
        state.liveSpansState.setIsOn(false);

        return {
          timeframeState: {
            ...state.timeframeState,
            currentTimeframe: {
              startTimeUnixNanoSec: newStartTimeUnixNanoSec,
              endTimeUnixNanoSec: newEndTimeUnixNanoSec,
              isRelative: false,
            },
          },
        };
      });
    },
  },
});

export const isFiltersStructureEqual = (
  k1: string,
  k2: string,
  o1: Operator,
  o2: Operator
) => k1 === k2 && o1 === o2;

interface FiltersSlice {
  filtersState: {
    filters: Array<SearchFilter>;
    createOrUpdateFilter: (
      filter: SearchFilter,
      previousFilter?: SearchFilter
    ) => void;
    deleteFilter: (key: string, operator: Operator) => void;
    clearFilters: () => void;
  };
}
const createFiltersSlice: StateCreator<
  LiveSpansSlice & TimeframeSlice & FiltersSlice & SortSlice,
  [],
  [["zustand/immer", never]],
  FiltersSlice
> = immer((set) => ({
  filtersState: {
    filters: [],
    // If this function is called with a filter that doesn't exist in the state, it will create and add it to 'filters'
    // If the filter exists, it will simply update it with the desired values
    createOrUpdateFilter: (
      filter: SearchFilter,
      previousFilter?: SearchFilter
    ) =>
      set((state) => {
        const targetFilter = previousFilter ?? filter;
        const existFilterIndex = state.filtersState.filters.findIndex((f) =>
          isFiltersStructureEqual(
            f.keyValueFilter.key,
            targetFilter.keyValueFilter.key,
            f.keyValueFilter.operator,
            targetFilter.keyValueFilter.operator
          )
        );
        if (existFilterIndex !== -1) {
          state.filtersState.filters[existFilterIndex] = filter;
        } else {
          state.filtersState.filters.push(filter);
        }
      }),
    deleteFilter: (key: string, operator: Operator) =>
      set((state) => {
        const filterIndex = state.filtersState.filters.findIndex((f) =>
          isFiltersStructureEqual(
            f.keyValueFilter.key,
            key,
            f.keyValueFilter.operator,
            operator
          )
        );
        state.filtersState.filters.splice(filterIndex, 1);
      }),
    clearFilters: () =>
      set((state) => {
        state.filtersState.filters = [];
      }),
  },
}));

interface SortSlice {
  sortState: {
    sort: Sort[];
    setSort: (sort: Sort[]) => void;
  };
}

const DEFAULT_SORT_FIELD = "span.startTimeUnixNano";
const DEFAULT_SORT_ASC = false;

const createSortSlice: StateCreator<
  LiveSpansSlice & TimeframeSlice & FiltersSlice & SortSlice,
  [],
  [],
  SortSlice
> = (set) => ({
  sortState: {
    sort: [{ field: DEFAULT_SORT_FIELD, ascending: DEFAULT_SORT_ASC }],
    setSort: (sort: Sort[]) =>
      set((state) => ({
        sortState: {
          ...state.sortState,
          sort: sort,
        },
      })),
  },
});

interface RecentlyUsedKeysSlice {
  recentlyUsedKeysState: {
    recentlyUsedKeys: AvailableTag[];
    addRecentlyUsedKey: (tag: AvailableTag) => void;
  };
}

const MAX_RECENTLY_USED_KEYS = 3;
const createRecentlyUsedKeysSlice: StateCreator<
  TimeframeSlice &
    LiveSpansSlice &
    FiltersSlice &
    SortSlice &
    RecentlyUsedKeysSlice,
  [],
  [],
  RecentlyUsedKeysSlice
> = (set) => ({
  recentlyUsedKeysState: {
    recentlyUsedKeys: [],
    addRecentlyUsedKey: (newTag) => {
      set((state) => {
        const recentlyUsedKeysNoDuplicates =
          state.recentlyUsedKeysState.recentlyUsedKeys.filter(
            (tag) => tag.name !== newTag.name
          );
        const updatedKeys = [newTag, ...recentlyUsedKeysNoDuplicates].slice(
          0,
          MAX_RECENTLY_USED_KEYS
        );

        return {
          recentlyUsedKeysState: {
            ...state.recentlyUsedKeysState,
            recentlyUsedKeys: updatedKeys,
          },
        };
      });
    },
  },
});

export const useSpanSearchStore = create<
  TimeframeSlice &
    LiveSpansSlice &
    FiltersSlice &
    SortSlice &
    RecentlyUsedKeysSlice
>()(
  persist(
    (...set) => ({
      ...createTimeframeSlice(...set),
      ...createLiveSpansSlice(...set),
      ...createFiltersSlice(...set),
      ...createSortSlice(...set),
      ...createRecentlyUsedKeysSlice(...set),
    }),
    {
      name: "teletrace-storage",
      // If you want to persist additional state, add it here!
      partialize: (state) => ({
        recentlyUsedKeysState: state.recentlyUsedKeysState,
      }),
      // By default, zustand's merge function is shallow and it causes hydration issues
      // when loading nested objects from state.
      // For now, the only persisted state is `recentlyUsedKeysState` and we solved this issue
      // by "teaching" zustand how to go a level deeper when merging this state.
      // If we add another nested object to be persisted, we should look for
      // a more general solution for deep merging.
      merge: (persisted, current) => ({
        ...current,
        recentlyUsedKeysState: {
          ...current.recentlyUsedKeysState,
          recentlyUsedKeys: (persisted as RecentlyUsedKeysSlice)
            .recentlyUsedKeysState.recentlyUsedKeys,
        },
      }),
    }
  )
);
