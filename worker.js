/**
 * GitHub Actions 定时触发器
 * 使用 Cloudflare Workers Cron Triggers 精确触发 GitHub Actions workflow
 *
 * 配置的任务：
 * 1. daily-tech-news: 每天 8:30 北京时间 (UTC 00:30)
 * 2. beauty-generator: 每天 20:00 北京时间 (UTC 12:00)
 */

// 任务配置
const WORKFLOWS = {
  'daily-tech-news': {
    owner: 'lairulan',
    repo: 'daily-tech-news',
    workflow: 'daily-news.yml',
    ref: 'main',
    description: 'AI科技财经日报'
  },
  'beauty-generator': {
    owner: 'lairulan',
    repo: 'beauty-generator',
    workflow: 'daily-publish.yml',
    ref: 'main',
    description: '每日美女图'
  }
};

/**
 * 触发 GitHub Actions workflow
 */
async function triggerWorkflow(workflow, token) {
  const url = `https://api.github.com/repos/${workflow.owner}/${workflow.repo}/actions/workflows/${workflow.workflow}/dispatches`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Accept': 'application/vnd.github.v3+json',
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'Cloudflare-Worker-Scheduler',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ref: workflow.ref
    })
  });

  if (response.status === 204) {
    return { success: true, message: `${workflow.description} 触发成功` };
  } else {
    const error = await response.text();
    return { success: false, message: `${workflow.description} 触发失败: ${response.status} - ${error}` };
  }
}

/**
 * 根据当前时间判断应该触发哪个任务
 * Cron 表达式在 wrangler.toml 中配置
 */
function getWorkflowToTrigger(scheduledTime) {
  const date = new Date(scheduledTime);
  const utcHour = date.getUTCHours();
  const utcMinute = date.getUTCMinutes();

  // UTC 00:30 = 北京时间 8:30 -> daily-tech-news
  if (utcHour === 0 && utcMinute >= 25 && utcMinute <= 35) {
    return WORKFLOWS['daily-tech-news'];
  }

  // UTC 12:00 = 北京时间 20:00 -> beauty-generator
  if (utcHour === 12 && utcMinute >= 0 && utcMinute <= 5) {
    return WORKFLOWS['beauty-generator'];
  }

  return null;
}

export default {
  /**
   * Cron 触发器处理函数
   */
  async scheduled(event, env, ctx) {
    const token = env.GITHUB_TOKEN;

    if (!token) {
      console.error('错误: 未设置 GITHUB_TOKEN');
      return;
    }

    const workflow = getWorkflowToTrigger(event.scheduledTime);

    if (!workflow) {
      console.log(`当前时间无需触发任务: ${new Date(event.scheduledTime).toISOString()}`);
      return;
    }

    console.log(`准备触发: ${workflow.description}`);
    const result = await triggerWorkflow(workflow, token);
    console.log(result.message);
  },

  /**
   * HTTP 请求处理函数 (用于手动触发和测试)
   */
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const token = env.GITHUB_TOKEN;

    // 健康检查
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({
        status: 'ok',
        workflows: Object.keys(WORKFLOWS),
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 手动触发特定任务
    if (url.pathname === '/trigger') {
      const workflowName = url.searchParams.get('workflow');

      if (!workflowName || !WORKFLOWS[workflowName]) {
        return new Response(JSON.stringify({
          error: '请指定有效的 workflow 参数',
          available: Object.keys(WORKFLOWS)
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (!token) {
        return new Response(JSON.stringify({
          error: '未配置 GITHUB_TOKEN'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const result = await triggerWorkflow(WORKFLOWS[workflowName], token);
      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 触发所有任务
    if (url.pathname === '/trigger-all') {
      if (!token) {
        return new Response(JSON.stringify({
          error: '未配置 GITHUB_TOKEN'
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      const results = [];
      for (const [name, workflow] of Object.entries(WORKFLOWS)) {
        const result = await triggerWorkflow(workflow, token);
        results.push({ workflow: name, ...result });
      }

      return new Response(JSON.stringify({
        results,
        timestamp: new Date().toISOString()
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 默认返回使用说明
    return new Response(JSON.stringify({
      name: 'GitHub Actions Scheduler',
      endpoints: {
        '/health': '健康检查',
        '/trigger?workflow=daily-tech-news': '触发AI科技财经日报',
        '/trigger?workflow=beauty-generator': '触发每日美女图',
        '/trigger-all': '触发所有任务'
      },
      cron_schedules: {
        'daily-tech-news': '每天 8:30 北京时间',
        'beauty-generator': '每天 20:00 北京时间'
      }
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
