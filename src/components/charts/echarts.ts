// Tree-shaken ECharts build: register only what the dashboard uses.
import * as echarts from 'echarts/core';
import { BarChart } from 'echarts/charts';
import { GridComponent, MarkAreaComponent, TooltipComponent } from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([BarChart, GridComponent, MarkAreaComponent, TooltipComponent, CanvasRenderer]);

export { echarts };
export type { EChartsCoreOption } from 'echarts/core';
