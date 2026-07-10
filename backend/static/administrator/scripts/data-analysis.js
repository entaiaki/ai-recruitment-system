// administrator/scripts/data-analysis.js

// 插件：把所有折线图在最后再画一遍，保证在线之上
const lineOnTopPlugin = {
    id: "lineOnTopPlugin",
    afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        chart.data.datasets.forEach((dataset, datasetIndex) => {
            const meta = chart.getDatasetMeta(datasetIndex);
            if (!meta || meta.hidden) return;
            if (dataset.type === "line" || meta.type === "line") {
                ctx.save();
                if (meta.dataset && typeof meta.dataset.draw === "function") {
                    meta.dataset.draw(ctx);
                }
                meta.data.forEach((element) => {
                    if (element && typeof element.draw === "function") {
                        element.draw(ctx);
                    }
                });
                ctx.restore();
            }
        });
    }
};

document.addEventListener("DOMContentLoaded", () => {
    // 向 PHP 获取数据（相对路径基于 data-analysis.html 所在的目录）
    fetch("php/data-analysis.php")
        .then((res) => res.json())
        .then((data) => {
            // 后端返回的数据结构：
            // {
            //   recruiterCount,
            //   jobSeekerCount,
            //   disciplines,
            //   disciplineCounts,
            //   regions,
            //   regionVacancies,
            //   regionAvgSalary
            // }

            const recruiterCount = Number(data.recruiterCount) || 0;
            const jobSeekerCount = Number(data.jobSeekerCount) || 0;

            const disciplines = Array.isArray(data.disciplines) ? data.disciplines : [];
            const disciplineCounts = Array.isArray(data.disciplineCounts) ? data.disciplineCounts : [];

            const regions = Array.isArray(data.regions) ? data.regions : [];
            const regionVacancies = Array.isArray(data.regionVacancies) ? data.regionVacancies : [];
            const regionAvgSalary = Array.isArray(data.regionAvgSalary) ? data.regionAvgSalary : [];

            // ✅ 这里传 disciplines / disciplineCounts
            renderCharts({
                recruiterCount,
                jobSeekerCount,
                disciplines,
                disciplineCounts,
                regions,
                regionVacancies,
                regionAvgSalary
            });
        })
        .catch((err) => {
            console.error("Failed to load data-analysis JSON:", err);

            // 如果出错，用一份默认数据，字段名也要保持一致
            renderCharts({
                recruiterCount: 0,
                jobSeekerCount: 0,
                disciplines: ["Discipline A", "Discipline B", "Discipline C"],
                disciplineCounts: [0, 0, 0],
                regions: ["Guangzhou", "Shenzhen", "Foshan", "Hong Kong", "Other"],
                regionVacancies: [0, 0, 0, 0, 0],
                regionAvgSalary: [0, 0, 0, 0, 0]
            });
        });
});

function renderCharts({
    recruiterCount,
    jobSeekerCount,
    disciplines,
    disciplineCounts,
    regions,
    regionVacancies,
    regionAvgSalary
}) {
    /* ========== 1. 左侧 Pie Chart（tooltip 显示数量 + 百分比） ========== */
    const pieCanvas = document.getElementById("categoryPieChart");
    if (pieCanvas) {
        const pieCtx = pieCanvas.getContext("2d");
        const pieDataArr = [recruiterCount, jobSeekerCount];

        new Chart(pieCtx, {
            type: "doughnut",
            data: {
                labels: ["recruiter", "job seeker"],
                datasets: [
                    {
                        data: pieDataArr,
                        backgroundColor: ["#3B82F6", "#10B981"],
                        borderWidth: 0,
                        cutout: "80%"
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        enabled: true,
                        callbacks: {
                            label: function (context) {
                                const label = context.label;
                                const value = context.parsed;
                                const total = pieDataArr.reduce((sum, v) => sum + v, 0) || 1;
                                const percent = ((value / total) * 100).toFixed(1);
                                return `${label}: ${value} (${percent}%)`;
                            }
                        }
                    }
                }
            }
        });
    }

    /* ========== 2. discipline 数量柱状图 ========== */
    const barCanvas = document.getElementById("positionsBarChart");
    if (barCanvas) {
        const barCtx = barCanvas.getContext("2d");

        new Chart(barCtx, {
            type: "bar",
            data: {
                labels: disciplines,
                datasets: [
                    {
                        label: "Discipline Count",
                        data: disciplineCounts,
                        backgroundColor: "#3B82F6",
                        borderRadius: 2,
                        barPercentage: 0.8
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { font: { size: 8 } },
                        grid: { color: "rgba(0,0,0,0.05)", drawBorder: false }
                    },
                    x: {
                        ticks: { font: { size: 8 } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: true }
                }
            }
        });
    }

    /* ========== 3. 地区 vacancies + 平均工资 双轴图 ========== */
    const regionCanvas = document.getElementById("regionVacancySalaryChart");
    if (regionCanvas) {
        const regionCtx = regionCanvas.getContext("2d");

        new Chart(regionCtx, {
            type: "bar",
            data: {
                labels: regions,
                datasets: [
                    {
                        type: "bar",
                        label: "Total vacancies",
                        data: regionVacancies,
                        backgroundColor: "#3B82F6",
                        borderRadius: 3,
                        barPercentage: 0.7,
                        categoryPercentage: 0.7,
                        yAxisID: "y",
                        order: 1
                    },
                    {
                        type: "line",
                        label: "Average salary",
                        data: regionAvgSalary,
                        borderColor: "#10B981",
                        backgroundColor: "#10B981",
                        borderWidth: 2,
                        fill: false,
                        tension: 0.3,
                        pointRadius: 3,
                        pointHoverRadius: 4,
                        yAxisID: "y1",
                        order: 2
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        position: "left",
                        title: {
                            display: true,
                            text: "Total vacancies",
                            font: { size: 10 }
                        },
                        ticks: { font: { size: 8 } },
                        grid: {
                            color: "rgba(0,0,0,0.05)",
                            drawBorder: false
                        }
                    },
                    y1: {
                        beginAtZero: true,
                        position: "right",
                        title: {
                            display: true,
                            text: "Average salary",
                            font: { size: 10 }
                        },
                        ticks: { font: { size: 8 } },
                        grid: { drawOnChartArea: false }
                    },
                    x: {
                        ticks: { font: { size: 8 } },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: {
                        display: true,
                        labels: {
                            boxWidth: 10,
                            font: { size: 9 }
                        }
                    },
                    tooltip: { enabled: true }
                }
            },
            plugins: [lineOnTopPlugin]
        });
    }
}
