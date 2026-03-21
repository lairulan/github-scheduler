/**
 * GitHub Actions 定时调度器 + 每日 Telegram 运行状态报告
 *
 * 合并管理多个定时任务：
 * - sub2api-daily-report: 每天 01:00 北京时间 (UTC 17:00)
 * - daily-tech-news: 每天 08:30 北京时间 (UTC 00:30)
 * - health-wellness: 每天 09:00 北京时间 (UTC 01:00)
 * - daily-ai-briefing: 每天 10:00 北京时间 (UTC 02:00)
 * - skill-digest: 每天 12:00 北京时间 (UTC 04:00)
 * - daily-beauty: 每天 19:30 北京时间 (UTC 11:30)
 * - daily-robot-insights: 每天 20:00 北京时间 (UTC 12:00)
 * - daily-psychology: 每天 20:00 北京时间 (UTC 12:00)
 *
 * Telegram 日报: 每天 22:00 北京时间 (UTC 14:00)
 */

// 任务配置
const JOBS = {
  'sub2api-daily-report': {
    repo: 'lairulan/sub2api-daily-report',
    event_type: 'sub2api-daily-report',
    cron_hour: 17,  // UTC 17:00 = 01:00 北京时间
    cron_minute: 0,
    description: 'Sub2API 服务器运营报告 (01:00 北京时间)'
  },
  'daily-tech-news': {
    repo: 'lairulan/daily-tech-news',
    event_type: 'daily-tech-news',
    cron_hour: 0,  // UTC 00:xx
    cron_minute: 30,
    description: '每日科技新闻 (08:30 北京时间)'
  },
  'health-wellness': {
    repo: 'lairulan/health-wellness-publisher',
    event_type: 'daily-wellness',
    cron_hour: 1,  // UTC 01:00 = 09:00 北京时间
    cron_minute: 0,
    description: '手工暖食小馆养生内容 (09:00 北京时间, 隔天发布)'
  },
  'daily-ai-briefing': {
    repo: 'lairulan/daily-ai-briefing',
    event_type: 'daily-ai-briefing',
    cron_hour: 2,  // UTC 02:00 = 10:00 北京时间
    cron_minute: 0,
    description: 'AI大事件邮件日报 (10:00 北京时间)'
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
    cron_hour: 11,  // UTC 11:30 = 19:30 北京时间
    cron_minute: 30,
    description: '每日艺术写真 (19:30 北京时间)'
  },
  'daily-robot-insights': {
    repo: 'lairulan/industrial-robot-insights',
    event_type: 'daily-robot-insights',
    cron_hour: 12,  // UTC 12:00 = 20:00 北京时间
    cron_minute: 0,
    weekdays: [1, 3, 5],  // 仅周一、三、五
    description: '工业机器人洞察 (20:00 北京时间, 周一三五)'
  },
  'daily-psychology': {
    repo: 'lairulan/teen-psychology-insights',
    event_type: 'daily-psychology',
    cron_hour: 12,  // UTC 12:00 = 20:00 北京时间
    cron_minute: 0,
    description: '心光馨语心理学文章 (20:00 北京时间)'
  }
};

// 日报配置：UTC 14:00 = 22:00 北京时间
const REPORT_HOUR = 14;
const REPORT_MINUTE = 0;

export default {
  // 定时任务处理
  async scheduled(event, env, ctx) {
    const now = new Date(event.scheduledTime);
    const hour = now.getUTCHours();
    const minute = now.getUTCMinutes();

    console.log(`Scheduled event at UTC ${hour}:${minute}`);

    // 检查是否是日报时间 (UTC 14:00 = 22:00 北京时间)
    if (hour === REPORT_HOUR && Math.abs(minute - REPORT_MINUTE) <= 5) {
      console.log('Triggering daily status report...');
      ctx.waitUntil(sendDailyReport(env));
      return;
    }

    // 根据时间确定要触发的任务
    const dayOfWeek = now.getUTCDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
    for (const [name, job] of Object.entries(JOBS)) {
      if (job.cron_hour === hour && Math.abs(job.cron_minute - minute) <= 5) {
        // 检查星期限制（如果配置了 weekdays）
        if (job.weekdays && !job.weekdays.includes(dayOfWeek)) {
          console.log(`Skipping ${name}: weekday ${dayOfWeek} not in [${job.weekdays}]`);
          continue;
        }
        console.log(`Triggering job: ${name}`);
        const result = await triggerWorkflow(env, job.repo, job.event_type);
        console.log(`${name} result:`, JSON.stringify(result));
      }
    }
  },

  // HTTP 请求处理（用于手动测试）
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 手动触发日报
    if (url.pathname === '/report') {
      const result = await sendDailyReport(env);
      return jsonResponse(result);
    }

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
        '/trigger-all': '触发所有任务',
        '/report': '手动触发 Telegram 日报'
      }
    });
  }
};

// ─── GitHub Actions 状态查询 ────────────────────────────

async function getWorkflowRuns(env, repo) {
  const GITHUB_TOKEN = env.GITHUB_TOKEN;
  if (!GITHUB_TOKEN) return { error: 'GITHUB_TOKEN not configured' };

  // 查询今天的 workflow runs (最近 24 小时)
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const response = await fetch(
      `https://api.github.com/repos/${repo}/actions/runs?created=>${since.slice(0, 10)}&per_page=5`,
      {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'Cloudflare-Worker-GitHub-Scheduler'
        }
      }
    );

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    return data.workflow_runs || [];
  } catch (error) {
    return { error: error.message };
  }
}

// ─── 每日状态报告 ───────────────────────────────────────

async function sendDailyReport(env) {
  const now = new Date();
  // 北京时间
  const bjt = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const dateStr = bjt.toISOString().slice(0, 10);
  const timeStr = bjt.toISOString().slice(11, 16);

  // 获取今天是星期几（北京时间）
  const weekdayNames = ['日', '一', '二', '三', '四', '五', '六'];
  const bjtDay = bjt.getUTCDay();

  const results = [];
  let successCount = 0;
  let failCount = 0;
  let skipCount = 0;

  // 逐个检查每个 skill 的 workflow 运行状态
  for (const [name, job] of Object.entries(JOBS)) {
    const runs = await getWorkflowRuns(env, job.repo);

    if (runs.error) {
      results.push({ name, description: job.description, status: 'error', detail: runs.error });
      failCount++;
      continue;
    }

    if (!Array.isArray(runs) || runs.length === 0) {
      // 检查是否是因为今天不该运行（如周一三五限制）
      if (job.weekdays && !job.weekdays.includes(bjtDay)) {
        results.push({ name, description: job.description, status: 'skipped', detail: '非运行日' });
        skipCount++;
      } else {
        results.push({ name, description: job.description, status: 'no_run', detail: '今日无运行记录' });
        failCount++;
      }
      continue;
    }

    // 取最新一次运行
    const latest = runs[0];
    const conclusion = latest.conclusion; // success, failure, cancelled, skipped, null (in progress)
    const status = latest.status; // completed, in_progress, queued
    const runUrl = latest.html_url;

    // 计算运行时长
    let duration = '';
    if (latest.run_started_at) {
      const start = new Date(latest.run_started_at);
      const end = latest.updated_at ? new Date(latest.updated_at) : now;
      const mins = Math.round((end - start) / 60000);
      duration = mins < 60 ? `${mins}min` : `${Math.floor(mins / 60)}h${mins % 60}m`;
    }

    if (status !== 'completed') {
      results.push({
        name, description: job.description,
        status: 'running', detail: `${status}`, duration, url: runUrl
      });
      continue;
    }

    if (conclusion === 'success') {
      results.push({
        name, description: job.description,
        status: 'success', detail: '', duration, url: runUrl
      });
      successCount++;
    } else if (conclusion === 'skipped') {
      results.push({
        name, description: job.description,
        status: 'skipped', detail: '已跳过（去重/隔天）', duration, url: runUrl
      });
      skipCount++;
    } else {
      results.push({
        name, description: job.description,
        status: 'fail', detail: conclusion || 'unknown', duration, url: runUrl
      });
      failCount++;
    }
  }

  // 构建 Telegram 消息 (HTML 格式)
  const totalJobs = Object.keys(JOBS).length;
  const allGood = failCount === 0;
  const statusIcon = allGood ? 'ALL PASS' : `${failCount} FAILED`;

  const lines = [
    `<b>Skill 定时任务日报</b>`,
    `<code>${dateStr} 周${weekdayNames[bjtDay]}</code> | ${statusIcon}`,
    '',
    `━━ <b>运行概览</b> ━━━━━━━━━━`,
    `成功: <b>${successCount}</b> | 失败: <b>${failCount}</b> | 跳过: <b>${skipCount}</b> | 总计: ${totalJobs}`,
    '',
    `━━ <b>详细状态</b> ━━━━━━━━━━`,
  ];

  for (const r of results) {
    let icon;
    switch (r.status) {
      case 'success': icon = '[OK]'; break;
      case 'fail': icon = '[!!]'; break;
      case 'error': icon = '[!!]'; break;
      case 'no_run': icon = '[??]'; break;
      case 'running': icon = '[..]'; break;
      case 'skipped': icon = '[--]'; break;
      default: icon = '[??]';
    }

    const durationStr = r.duration ? ` (${r.duration})` : '';
    const detailStr = r.detail ? ` - ${r.detail}` : '';
    const shortDesc = r.description.replace(/\s*\(.*\)/, '');

    lines.push(`${icon} <b>${shortDesc}</b>${durationStr}${detailStr}`);
  }

  // 如果有失败，添加链接
  const failedRuns = results.filter(r => r.status === 'fail' || r.status === 'error' || r.status === 'no_run');
  if (failedRuns.length > 0) {
    lines.push('');
    lines.push('━━ <b>需要关注</b> ━━━━━━━━━━');
    for (const r of failedRuns) {
      if (r.url) {
        lines.push(`<a href="${r.url}">${r.name}</a>: ${r.detail || r.status}`);
      } else {
        lines.push(`${r.name}: ${r.detail || r.status}`);
      }
    }
  }

  lines.push('');
  lines.push(`<i>${timeStr} CST | github-scheduler</i>`);

  const message = lines.join('\n');

  // 发送到 Telegram
  const tgResult = await sendTelegram(env, message);

  return {
    success: tgResult.ok === true,
    date: dateStr,
    summary: { success: successCount, fail: failCount, skip: skipCount, total: totalJobs },
    telegram: tgResult
  };
}

// ─── Telegram 消息发送 ──────────────────────────────────

async function sendTelegram(env, text) {
  const botToken = env.TG_BOT_TOKEN;
  const chatId = env.TG_CHAT_ID;

  if (!botToken || !chatId) {
    console.log('Telegram not configured (TG_BOT_TOKEN / TG_CHAT_ID missing)');
    return { ok: false, error: 'Telegram not configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML',
        disable_web_page_preview: true
      })
    });

    const result = await response.json();
    if (!result.ok) {
      console.log('Telegram send failed:', JSON.stringify(result));
    }
    return result;
  } catch (error) {
    console.log('Telegram send error:', error.message);
    return { ok: false, error: error.message };
  }
}

// ─── 原有功能 ───────────────────────────────────────────

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
