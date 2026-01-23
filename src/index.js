/**
 * GitHub Actions 定时调度器
 *
 * 合并管理多个定时任务：
 * - daily-tech-news: 每天 08:30 北京时间 (UTC 00:30)
 * - skill-digest: 每天 12:00 北京时间 (UTC 04:00)
 * - daily-beauty: 每天 20:00 北京时间 (UTC 12:00)
 * - daily-robot-insights: 每天 20:05 北京时间 (UTC 12:05)
 */

// 任务配置
const JOBS = {
  'daily-tech-news': {
    repo: 'lairulan/daily-tech-news',
    event_type: 'daily-tech-news',
    cron_hour: 0,  // UTC 00:xx
    cron_minute: 30,
    description: '每日科技新闻 (08:30 北京时间)'
  },
  'skill-digest': {
    repo: 'lairulan/skill-digest',
    event_type: 'daily-skill-digest',
    cron_hour: 4,  // UTC 04:xx
    cron_minute: 0,
    description: '每日 Skill 精选 (12:00 北京时间)'
  },
  'daily-beauty': {
    repo: 'lairulan/beauty-generator',
    event_type: 'daily-beauty',
    cron_hour: 12,  // UTC 12:xx = 20:00 北京时间
    cron_minute: 0,
    description: '每日艺术写真 (20:00 北京时间)'
  },
  'daily-robot-insights': {
    repo: 'lairulan/industrial-robot-insights',
    event_type: 'daily-robot-insights',
    cron_hour: 12,  // UTC 12:xx = 20:xx 北京时间
    cron_minute: 5,
    description: '工业机器人洞察 (20:05 北京时间)'
  }
};

export default {
  // 定时任务处理
  async scheduled(event, env, ctx) {
    const now = new Date(event.scheduledTime);
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    console.log(`Scheduled event at UTC ${hour}:${minute}`);

    // 根据时间确定要触发的任务
    for (const [name, job] of Object.entries(JOBS)) {
      if (job.cron_hour === hour && Math.abs(job.cron_minute - minute) <= 5) {
        console.log(`Triggering job: ${name}`);
        const result = await triggerWorkflow(env, job.repo, job.event_type);
        console.log(`${name} result:`, JSON.stringify(result));
      }
    }
  },

  // HTTP 请求处理（用于手动测试）
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 手动触发特定任务
    if (url.pathname.startsWith('/trigger/')) {
      const jobName = url.pathname.replace('/trigger/', '');
      const job = JOBS[jobName];

      if (!job) {
        return jsonResponse({ error: `Unknown job: ${jobName}`, available: Object.keys(JOBS) }, 404);
      }

      const result = await triggerWorkflow(env, job.repo, job.event_type);
      return jsonResponse({ job: jobName, ...result });
    }

    // 触发所有任务
    if (url.pathname === '/trigger-all') {
      const results = {};
      for (const [name, job] of Object.entries(JOBS)) {
        results[name] = await triggerWorkflow(env, job.repo, job.event_type);
      }
      return jsonResponse({ results });
    }

    // 首页信息
    return jsonResponse({
      name: 'GitHub Actions 定时调度器',
      jobs: Object.entries(JOBS).map(([name, job]) => ({
        name,
        description: job.description,
        repo: job.repo,
        trigger_url: `/trigger/${name}`
      })),
      endpoints: {
        '/trigger/{job}': '触发指定任务',
        '/trigger-all': '触发所有任务'
      }
    });
  }
};

async function triggerWorkflow(env, repo, eventType) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;

  if (!GITHUB_TOKEN) {
    return { success: false, error: 'GITHUB_TOKEN not configured' };
  }

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/dispatches`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker-GitHub-Scheduler',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ event_type: eventType })
      }
    );

    if (response.status === 204) {
      return {
        success: true,
        message: 'Workflow triggered',
        repo,
        event_type: eventType,
        timestamp: new Date().toISOString()
      };
    } else {
      const text = await response.text();
      return {
        success: false,
        status: response.status,
        error: text
      };
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}
