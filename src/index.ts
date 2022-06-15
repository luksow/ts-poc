import express, { RequestHandler, Request, Response, NextFunction } from 'express';
import { z } from "zod";
import {v4} from 'uuid';

/**
 * UTIL
 */

 type Tagged<T, Tag> = T & { __tag: Tag };
  
function entityAs<T extends z.ZodRawShape, O>(object: z.ZodObject<T, any, any, O, any>, result: (o: O) => RequestHandler): RequestHandler {
    return ((req: Request, res: Response, next: NextFunction) => {
        const o = object.safeParse(req.body);
        if (o.success) {
            return result(o.data)(req, res, next);
        } else {
            res.status(400);
            res.send(JSON.stringify(o.error))
        }
    });
}

function headerValueByName(name: string, result: (h: string | string[]) => RequestHandler): RequestHandler {
    return ((req: Request, res: Response, next: NextFunction) => {
        const value = req.headers[name.toLowerCase()]
        if (value === undefined) {
            res.status(400);
            res.send(`No header ${name}`)
            return;
        } else {
            return result(value)(req, res, next)
        }
    });
}

function completeAsJson(result: (() => [number, unknown])): RequestHandler {
    return ((req: Request, res: Response, next: NextFunction) => {
        const ev = result();
        res.status(ev[0]);
        res.send(ev[1]);
    })
}

/**
 * DOMAIN
 */

type ProjectName = Tagged<string, 'ProjectName'>
const projectNameFormat: z.Schema<ProjectName> = z.string().trim().min(1) as never;
type ProjectId = Tagged<string, 'ProjectId'>
const projectIdFormat: z.Schema<ProjectId> = z.string().uuid() as never;
type UserId = Tagged<string, 'UserId'>
const userIdFormat: z.Schema<UserId> = z.string().uuid() as never;

const Project = z.object({
    id: projectIdFormat,
    userId: userIdFormat,
    name: projectNameFormat
});

type Project = z.infer<typeof Project>;

/**
 * DTO
 */

const CreateProjectRequest = z.object({
    name: projectNameFormat
})

type CreateProjectRequest = z.infer<typeof CreateProjectRequest>
type CreateProjectResponse = {type: "Created", project: Project} | {type: "UserNotFound", userId: UserId}

/**
 * SERVICE
 */

function createProject(userId: UserId, request: CreateProjectRequest): CreateProjectResponse {
    const rand = Math.random()
    if (rand < 0.3) {
        return {type:"UserNotFound", userId: userId};
    } else {
        return {type: "Created", project: {...request, userId: userId, id: projectIdFormat.parse(v4())}};
    }
}

/**
 * MAIN
 */
const app = express();
app.use(express.json())

app.post('/', entityAs(CreateProjectRequest, (request) => {
    return headerValueByName("Authorization", (token) => {
        return completeAsJson(() => {
            const response = createProject(userIdFormat.parse(token), request); // TODO: this parse can fail :shrug:
            switch(response.type) {
                case "Created": return [201, response.project]
                case "UserNotFound": return [404, "Sry, no user found"]
            }
            
        })
    });
}));

app.listen(3000, () => console.log("Yo, it's running"));