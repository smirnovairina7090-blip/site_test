import {GET,POST,PATCH} from '../app/api/[...path]/route';
export default {fetch(request:Request){return request.method==='GET'?GET(request):request.method==='PATCH'?PATCH(request):POST(request);}};
